import React, { useState, useEffect, useCallback } from "react";
import { displayOrderNumber } from "@/utils/orderNumber";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Image,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ComeYaColors, Spacing, BorderRadius } from "../../../constants/theme";
import { apiRequest } from "@/lib/query-client";

interface Props {
  theme: any;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
}

interface Payout {
  id: string;
  orderId: string;
  recipientId: string;
  recipientType: "business" | "driver";
  amount: number;
  method: string | null;
  accountSnapshot: string | null;
  status: "pending" | "paid" | "stripe_auto";
  paidBy: string | null;
  paidAt: string | null;
  notes: string | null;
  proofUrl?: string | null;
  stripeTransferId?: string | null;
  isWithdrawal?: boolean;
  createdAt: string;
  recipientName?: string;
  paymentAccounts?: any[];
  businessName?: string | null;
}

// Métodos de pago España
const METHOD_LABELS: Record<string, string> = {
  bizum: "Bizum",
  transferencia: "Transferencia IBAN",
  paypal: "PayPal",
  stripe: "Stripe (automático)",
  manual: "Pago manual del admin",
  stripe_failed_manual: "Stripe fallido → manual",
  stripe_card: "Tarjeta (Stripe)",
  stripe_bizum: "Bizum (Stripe)",
  cash: "Efectivo",
};

const fmt = (cents: number) => `${(cents / 100).toFixed(2)} €`;

export const FinanceTab: React.FC<Props> = ({ theme, showToast }) => {
  const [tab, setTab] = useState<
    "payouts" | "history" | "metrics" | "tips" | "drivers"
  >("payouts");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingPayouts, setPendingPayouts] = useState<Payout[]>([]);
  const [paidPayouts, setPaidPayouts] = useState<Payout[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [selected, setSelected] = useState<Payout | null>(null);
  const [notes, setNotes] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("bizum");
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [payoutsRes, historyRes, metricsRes] = await Promise.all([
        apiRequest("GET", "/api/admin/finance/payouts/pending"),
        apiRequest("GET", "/api/admin/finance/payouts/history"),
        apiRequest("GET", "/api/digital-payments/metrics"),
      ]);
      const [payoutsData, historyData, metricsData] = await Promise.all([
        payoutsRes.json(),
        historyRes.json(),
        metricsRes.json(),
      ]);
      if (payoutsData.success) setPendingPayouts(payoutsData.payouts ?? []);
      if (historyData.success) setPaidPayouts(historyData.payouts ?? []);
      if (metricsData.success) setMetrics(metricsData);
    } catch {
      showToast("Error al cargar datos financieros", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, []);

  const markPaid = async (payout: Payout) => {
    if (!notes.trim()) {
      showToast("Escribe la referencia / nota de la transferencia", "error");
      return;
    }
    if (!proofUri) {
      showToast("Adjunta la captura del comprobante de la transferencia", "error");
      return;
    }

    setProcessing(payout.id);
    try {
      // 1. Subir la captura a Cloudinary
      let proofUrl: string | null = null;
      try {
        const encoding = (FileSystem as any)?.EncodingType?.Base64 || "base64";
        const base64 = await (FileSystem as any).readAsStringAsync(proofUri, {
          encoding,
        });
        const extension = proofUri.split(".").pop()?.toLowerCase() || "jpg";
        const mimeType = extension === "png" ? "image/png" : "image/jpeg";
        const uploadRes = await apiRequest(
          "POST",
          "/api/admin/finance/payout-proof-upload",
          { image: `data:${mimeType};base64,${base64}` },
        );
        const uploadData = await uploadRes.json();
        if (!uploadData.success) {
          showToast(uploadData.error || "No se pudo subir el comprobante", "error");
          setProcessing(null);
          return;
        }
        proofUrl = uploadData.url;
      } catch (uploadErr: any) {
        showToast(
          uploadErr?.message || "No se pudo subir el comprobante",
          "error",
        );
        setProcessing(null);
        return;
      }

      // 2. Registrar el pago
      const res = await apiRequest(
        "POST",
        `/api/admin/finance/payouts/${payout.id}/mark-paid`,
        {
          notes: notes.trim(),
          method: payoutMethod,
          proofUrl,
        },
      );
      const data = await res.json();
      if (data.success) {
        setPendingPayouts((prev) => prev.filter((p) => p.id !== payout.id));
        setSelected(null);
        setNotes("");
        setProofUri(null);
        setPayoutMethod("bizum");
        showToast(
          "✅ Pago registrado. Notificación enviada al recipiente.",
          "success",
        );
        load(); // recargar historial
      } else {
        showToast(data.error ?? "Error al procesar", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Error de conexión", "error");
    } finally {
      setProcessing(null);
    }
  };

  const s = st(theme);
  const insets = useSafeAreaInsets();

  if (loading) {
    return (
      <View style={[s.centered, { flex: 1 }]}>
        <ActivityIndicator size="large" color={ComeYaColors.primary} />
      </View>
    );
  }

  // ── Detalle de payout ──────────────────────────────────────────────────────
  if (selected) {
    const accounts: any[] = selected.paymentAccounts || [];
    const snap = selected.accountSnapshot
      ? (() => {
          try {
            return JSON.parse(selected.accountSnapshot!);
          } catch {
            return null;
          }
        })()
      : null;

    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
      >
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => {
            setSelected(null);
            setNotes("");
          }}
        >
          <Feather name="arrow-left" size={18} color={theme.text} />
          <Text style={[s.backText, { color: theme.text }]}>
            Volver a la lista
          </Text>
        </TouchableOpacity>

        {/* Resumen */}
        <View style={s.card}>
          <View style={s.row}>
            <View
              style={[
                s.badge,
                {
                  backgroundColor:
                    selected.recipientType === "business"
                      ? ComeYaColors.primary + "20"
                      : ComeYaColors.warning + "20",
                },
              ]}
            >
              <Text
                style={[
                  s.badgeText,
                  {
                    color:
                      selected.recipientType === "business"
                        ? ComeYaColors.primary
                        : ComeYaColors.warning,
                  },
                ]}
              >
                {selected.recipientType === "business"
                  ? "Negocio"
                  : "Repartidor"}
              </Text>
            </View>
            <Text style={[s.amount, { color: ComeYaColors.success }]}>
              {fmt(selected.amount)}
            </Text>
          </View>
          <Text style={[s.name, { color: theme.text }]}>
            {selected.recipientName ?? "—"}
          </Text>
          {selected.businessName && selected.recipientType === "driver" && (
            <Text style={[s.sub, { color: theme.textSecondary }]}>
              Negocio: {selected.businessName}
            </Text>
          )}
          <Text style={[s.sub, { color: theme.textSecondary }]}>
            {selected.isWithdrawal ? "Retiro" : "Pedido"} #
            {displayOrderNumber({ id: selected.orderId })} ·{" "}
            {new Date(selected.createdAt).toLocaleDateString("es-ES")}
          </Text>
        </View>

        {/* Cuentas de pago registradas */}
        <View style={s.card}>
          <Text style={[s.cardTitle, { color: theme.text }]}>
            Cuenta para recibir el pago
          </Text>

          {/* Snapshot de la cuenta usada al crear el payout */}
          {snap && (
            <View
              style={[
                s.accountBox,
                { backgroundColor: theme.backgroundSecondary },
              ]}
            >
              <Text style={[s.accountLabel, { color: ComeYaColors.primary }]}>
                {METHOD_LABELS[snap.method] ?? snap.method}{" "}
                {snap.isDefault ? "✓ (principal)" : ""}
              </Text>
              {snap.pagoMovilPhone && (
                <Text style={[s.accountValue, { color: theme.text }]}>
                  Bizum: {snap.pagoMovilPhone}
                </Text>
              )}
              {snap.binanceId && (
                <Text style={[s.accountValue, { color: theme.text }]}>
                  IBAN: {snap.binanceId}
                </Text>
              )}
              {snap.zelleEmail && (
                <Text style={[s.accountValue, { color: theme.text }]}>
                  Titular: {snap.zelleEmail}
                </Text>
              )}
              {snap.zinliEmail && (
                <Text style={[s.accountValue, { color: theme.text }]}>
                  Titular tarjeta: {snap.zinliEmail}
                </Text>
              )}
              {snap.zellePhone && (
                <Text style={[s.accountValue, { color: theme.text }]}>
                  Últimos 4: **** {snap.zellePhone}
                </Text>
              )}
            </View>
          )}

          {/* Todas las cuentas del usuario */}
          {accounts.length > 0 && (
            <>
              <Text
                style={[
                  s.sub,
                  { color: theme.textSecondary, marginTop: 8, marginBottom: 4 },
                ]}
              >
                Todas sus cuentas:
              </Text>
              {accounts.map((acc: any) => (
                <View
                  key={acc.id}
                  style={[
                    s.accountBox,
                    { backgroundColor: theme.backgroundSecondary },
                  ]}
                >
                  <Text style={[s.accountLabel, { color: theme.text }]}>
                    {METHOD_LABELS[acc.method] ?? acc.method}
                    {acc.isDefault ? " ✓" : ""}
                  </Text>
                  {acc.pagoMovilPhone && (
                    <Text style={[s.accountValue, { color: theme.text }]}>
                      Bizum: {acc.pagoMovilPhone}
                    </Text>
                  )}
                  {acc.binanceId && (
                    <Text style={[s.accountValue, { color: theme.text }]}>
                      IBAN: {acc.binanceId}
                    </Text>
                  )}
                  {acc.zelleEmail && (
                    <Text style={[s.accountValue, { color: theme.text }]}>
                      Titular / PayPal: {acc.zelleEmail}
                    </Text>
                  )}
                  {acc.zinliEmail && (
                    <Text style={[s.accountValue, { color: theme.text }]}>
                      Titular tarjeta: {acc.zinliEmail}
                    </Text>
                  )}
                  {acc.zellePhone && (
                    <Text style={[s.accountValue, { color: theme.text }]}>
                      Últimos 4: **** {acc.zellePhone}
                    </Text>
                  )}
                </View>
              ))}
            </>
          )}

          {!snap && accounts.length === 0 && (
            <Text style={[s.sub, { color: ComeYaColors.warning }]}>
              ⚠️ Sin cuentas de pago registradas
            </Text>
          )}
        </View>

        {/* Registrar transferencia */}
        <View style={s.card}>
          <Text style={[s.cardTitle, { color: theme.text }]}>
            Registrar transferencia realizada
          </Text>

          {/* Método usado */}
          <Text
            style={[
              s.sub,
              { color: theme.textSecondary, marginBottom: 6, marginTop: 8 },
            ]}
          >
            Método de pago utilizado:
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
            {[
              { id: "bizum", label: "Bizum", color: "#00ADEF" },
              { id: "transferencia", label: "IBAN", color: "#2E7D32" },
              { id: "paypal", label: "PayPal", color: "#003087" },
            ].map((m) => (
              <TouchableOpacity
                key={m.id}
                onPress={() => setPayoutMethod(m.id)}
                style={[
                  s.methodChip,
                  {
                    backgroundColor:
                      payoutMethod === m.id
                        ? m.color
                        : theme.backgroundSecondary,
                    borderColor: payoutMethod === m.id ? m.color : theme.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: payoutMethod === m.id ? "#FFF" : theme.text,
                    fontWeight: "600",
                    fontSize: 13,
                  }}
                >
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Referencia */}
          <Text
            style={[s.sub, { color: theme.textSecondary, marginBottom: 6 }]}
          >
            Referencia / nota (obligatorio):
          </Text>
          <TextInput
            style={[
              s.input,
              {
                color: theme.text,
                borderColor: notes.trim() ? theme.border : ComeYaColors.warning,
                backgroundColor: theme.backgroundSecondary,
              },
            ]}
            placeholder="Ej: Bizum ref. 123456 — enviado a María García"
            placeholderTextColor={theme.textSecondary}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={2}
          />

          {/* Captura de transferencia */}
          <Text
            style={[
              s.sub,
              { color: theme.textSecondary, marginBottom: 6, marginTop: 12 },
            ]}
          >
            Captura del comprobante (obligatorio):
          </Text>
          {proofUri ? (
            <View>
              <Image
                source={{ uri: proofUri }}
                style={s.proofImage}
                resizeMode="contain"
              />
              <TouchableOpacity
                style={[
                  s.btn,
                  { backgroundColor: theme.backgroundSecondary, marginTop: 4 },
                ]}
                onPress={() => setProofUri(null)}
              >
                <Feather name="trash-2" size={14} color={theme.text} />
                <Text style={[s.btnText, { color: theme.text }]}>
                  Quitar imagen
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                s.btn,
                {
                  backgroundColor: theme.backgroundSecondary,
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderStyle: "dashed",
                },
              ]}
              onPress={async () => {
                const { status } =
                  await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== "granted") {
                  showToast("Se necesita permiso de galería", "error");
                  return;
                }
                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  quality: 0.8,
                });
                if (!result.canceled && result.assets[0])
                  setProofUri(result.assets[0].uri);
              }}
            >
              <Feather name="upload" size={16} color={theme.textSecondary} />
              <Text style={[s.btnText, { color: theme.textSecondary }]}>
                Subir captura de transferencia
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[
            s.btn,
            { backgroundColor: ComeYaColors.success },
            !notes.trim() || !proofUri || processing === selected.id
              ? { opacity: 0.5 }
              : null,
          ]}
          onPress={() => markPaid(selected)}
          disabled={processing === selected.id}
        >
          {processing === selected.id ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Feather name="check-circle" size={16} color="#FFF" />
              <Text style={s.btnText}>Confirmar pago realizado</Text>
            </>
          )}
        </TouchableOpacity>
        {(!notes.trim() || !proofUri) && (
          <Text style={[s.sub, { color: ComeYaColors.warning, marginTop: 6 }]}>
            Debes indicar la referencia y adjuntar la captura del comprobante
            para poder registrar el pago.
          </Text>
        )}
      </ScrollView>
    );
  }

  // ── Propinas manuales pendientes de verificación ─────────────────────────
  const [pendingTips, setPendingTips] = useState<any[]>([]);
  const [tipsLoading, setTipsLoading] = useState(false);

  const loadPendingTips = useCallback(async () => {
    setTipsLoading(true);
    try {
      const res = await apiRequest(
        "GET",
        "/api/admin/finance/pending-manual-tips",
      );
      const data = await res.json();
      setPendingTips(data.tips || []);
    } catch {}
    setTipsLoading(false);
  }, []);

  const verifyTip = async (txId: string) => {
    try {
      const res = await apiRequest(
        "POST",
        `/api/admin/finance/manual-tips/${txId}/verify`,
        {},
      );
      const data = await res.json();
      if (data.success) {
        showToast("Propina verificada y abonada al repartidor", "success");
        loadPendingTips();
      } else {
        showToast(data.error || "No se pudo verificar", "error");
      }
    } catch {
      showToast("Error de conexión", "error");
    }
  };

  const rejectTip = async (txId: string) => {
    try {
      const res = await apiRequest(
        "POST",
        `/api/admin/finance/manual-tips/${txId}/reject`,
        {},
      );
      const data = await res.json();
      if (data.success) {
        showToast("Propina rechazada", "info");
        loadPendingTips();
      } else {
        showToast(data.error || "No se pudo rechazar", "error");
      }
    } catch {
      showToast("Error de conexión", "error");
    }
  };

  // ── Ganancias mensuales por repartidor (facturación de autónomos) ────────
  const [monthlyMonth, setMonthlyMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [monthlyRows, setMonthlyRows] = useState<any[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyError, setMonthlyError] = useState("");

  const loadMonthly = useCallback(async () => {
    setMonthlyLoading(true);
    setMonthlyError("");
    try {
      const res = await apiRequest(
        "GET",
        `/api/admin/finance/driver-monthly-earnings?month=${monthlyMonth}`,
      );
      const data = await res.json();
      if (data.success) setMonthlyRows(data.rows || []);
      else setMonthlyError(data.error || "Error al cargar");
    } catch {
      setMonthlyError("Error de conexión");
    }
    setMonthlyLoading(false);
  }, [monthlyMonth]);

  useEffect(() => {
    if (tab === "tips") loadPendingTips();
    if (tab === "drivers") loadMonthly();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, monthlyMonth]);

  // ── Lista principal ────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      {/* Tabs */}
      <View style={[s.tabBar, { paddingTop: insets.top }]}>
        {(["payouts", "history", "metrics", "tips", "drivers"] as const).map(
          (t) => (
            <TouchableOpacity
              key={t}
              style={[s.tabBtn, tab === t && s.tabBtnActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[s.tabLabel, tab === t && s.tabLabelActive]}>
                {t === "payouts"
                  ? `Pendientes${pendingPayouts.length ? ` (${pendingPayouts.length})` : ""}`
                  : t === "history"
                    ? `Pagados${paidPayouts.length ? ` (${paidPayouts.length})` : ""}`
                    : t === "metrics"
                      ? "Métricas"
                      : t === "tips"
                        ? `Propinas${pendingTips.length ? ` (${pendingTips.length})` : ""}`
                        : "Repartidores"}
              </Text>
            </TouchableOpacity>
          ),
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={ComeYaColors.primary}
          />
        }
      >
        {/* ── PAYOUTS ── */}
        {tab === "payouts" &&
          (pendingPayouts.length === 0 ? (
            <View style={s.empty}>
              <Feather
                name="check-circle"
                size={48}
                color={ComeYaColors.success}
              />
              <Text style={[s.emptyText, { color: theme.textSecondary }]}>
                Sin pagos pendientes
              </Text>
              <Text
                style={[
                  s.sub,
                  { color: theme.textSecondary, textAlign: "center" },
                ]}
              >
                Los pagos se generan automáticamente cuando el cliente confirma
                la entrega
              </Text>
            </View>
          ) : (
            pendingPayouts.map((payout) => (
              <TouchableOpacity
                key={payout.id}
                style={s.card}
                onPress={() => {
                  setSelected(payout);
                  setNotes("");
                }}
              >
                <View style={s.row}>
                  <View
                    style={[
                      s.badge,
                      {
                        backgroundColor:
                          payout.recipientType === "business"
                            ? ComeYaColors.primary + "20"
                            : ComeYaColors.warning + "20",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.badgeText,
                        {
                          color:
                            payout.recipientType === "business"
                              ? ComeYaColors.primary
                              : ComeYaColors.warning,
                        },
                      ]}
                    >
                      {payout.recipientType === "business"
                        ? "Negocio"
                        : "Repartidor"}
                    </Text>
                  </View>
                  <Text style={[s.amount, { color: ComeYaColors.success }]}>
                    {fmt(payout.amount)}
                  </Text>
                </View>
                <Text style={[s.name, { color: theme.text }]}>
                  {payout.recipientName ?? "—"}
                </Text>
                {payout.businessName && payout.recipientType === "driver" && (
                  <Text style={[s.sub, { color: theme.textSecondary }]}>
                    Negocio: {payout.businessName}
                  </Text>
                )}
                <Text style={[s.sub, { color: theme.textSecondary }]}>
                  {payout.isWithdrawal ? "Retiro" : "Pedido"} #
                  {displayOrderNumber({ id: payout.orderId })} ·{" "}
                  {new Date(payout.createdAt).toLocaleDateString("es-ES")}
                </Text>
                <View style={s.tapHint}>
                  <Feather name="send" size={13} color={ComeYaColors.primary} />
                  <Text
                    style={[s.tapHintText, { color: ComeYaColors.primary }]}
                  >
                    Ver cuenta y registrar pago
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          ))}

        {/* ── HISTORIAL ── */}
        {tab === "history" &&
          (paidPayouts.length === 0 ? (
            <View style={s.empty}>
              <Feather name="clock" size={48} color={theme.textSecondary} />
              <Text style={[s.emptyText, { color: theme.textSecondary }]}>
                Sin historial de pagos
              </Text>
              <Text
                style={[
                  s.sub,
                  {
                    color: theme.textSecondary,
                    textAlign: "center",
                    marginTop: 8,
                  },
                ]}
              >
                Los pagos que marques como completados aparecerán aquí
              </Text>
            </View>
          ) : (
            paidPayouts.map((payout) => (
              <View key={payout.id} style={s.card}>
                <View style={s.row}>
                  <View
                    style={[
                      s.badge,
                      {
                        backgroundColor:
                          payout.recipientType === "business"
                            ? ComeYaColors.primary + "20"
                            : ComeYaColors.warning + "20",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.badgeText,
                        {
                          color:
                            payout.recipientType === "business"
                              ? ComeYaColors.primary
                              : ComeYaColors.warning,
                        },
                      ]}
                    >
                      {payout.recipientType === "business"
                        ? "Negocio"
                        : "Repartidor"}
                    </Text>
                  </View>
                  <Text style={[s.amount, { color: ComeYaColors.success }]}>
                    {fmt(payout.amount)}
                  </Text>
                </View>
                <Text style={[s.name, { color: theme.text }]}>
                  {payout.recipientName ?? "—"}
                </Text>
                {payout.businessName && payout.recipientType === "driver" && (
                  <Text style={[s.sub, { color: theme.textSecondary }]}>
                    Negocio: {payout.businessName}
                  </Text>
                )}
                <Text style={[s.sub, { color: theme.textSecondary }]}>
                  {payout.isWithdrawal ? "Retiro" : "Pedido"} #
                  {displayOrderNumber({ id: payout.orderId })} · Creado:{" "}
                  {new Date(payout.createdAt).toLocaleDateString("es-ES")}
                </Text>
                {payout.method && (
                  <View
                    style={[
                      s.methodTag,
                      { backgroundColor: theme.backgroundSecondary },
                    ]}
                  >
                    <Feather
                      name={payout.status === "stripe_auto" ? "zap" : "check"}
                      size={12}
                      color={ComeYaColors.success}
                    />
                    <Text style={[s.sub, { color: theme.text }]}>
                      {payout.status === "stripe_auto"
                        ? "Pagado automáticamente vía "
                        : "Pagado via "}
                      {METHOD_LABELS[payout.method] ?? payout.method}
                    </Text>
                  </View>
                )}
                {payout.status === "stripe_auto" &&
                  payout.stripeTransferId && (
                    <Text style={[s.sub, { color: theme.textSecondary }]}>
                      Transfer Stripe: {payout.stripeTransferId.slice(0, 24)}…
                    </Text>
                  )}
                {payout.paidAt && (
                  <Text style={[s.sub, { color: ComeYaColors.success }]}>
                    ✓ Pagado:{" "}
                    {new Date(payout.paidAt).toLocaleDateString("es-ES")}
                  </Text>
                )}
                {payout.notes && (
                  <Text
                    style={[
                      s.sub,
                      { color: theme.textSecondary, fontStyle: "italic" },
                    ]}
                  >
                    Nota: {payout.notes}
                  </Text>
                )}
                {!!payout.proofUrl && (
                  <Image
                    source={{ uri: payout.proofUrl }}
                    style={[s.proofImage, { height: 120 }]}
                    resizeMode="contain"
                  />
                )}
              </View>
            ))
          ))}

        {/* ── MÉTRICAS ── */}
        {tab === "metrics" && (
          <>
            {/* KPIs */}
            <View
              style={[
                s.card,
                { flexDirection: "row", justifyContent: "space-around" },
              ]}
            >
              <KPI
                label="Pendientes"
                value={pendingPayouts.length}
                color={ComeYaColors.warning}
                theme={theme}
              />
              <KPI
                label="Total €"
                value={fmt(pendingPayouts.reduce((s, p) => s + p.amount, 0))}
                color={ComeYaColors.success}
                theme={theme}
              />
              <KPI
                label="Negocios"
                value={
                  pendingPayouts.filter((p) => p.recipientType === "business")
                    .length
                }
                color={ComeYaColors.primary}
                theme={theme}
              />
              <KPI
                label="Repartidores"
                value={
                  pendingPayouts.filter((p) => p.recipientType === "driver")
                    .length
                }
                color="#9C27B0"
                theme={theme}
              />
            </View>

            {/* Por método de pago */}
            {metrics?.totalByMethod &&
              Object.keys(metrics.totalByMethod).length > 0 && (
                <View style={s.card}>
                  <Text
                    style={[
                      s.cardTitle,
                      { color: theme.text, marginBottom: 12 },
                    ]}
                  >
                    Por método de pago
                  </Text>
                  {Object.entries(metrics.totalByMethod).map(
                    ([method, data]: any) => (
                      <View
                        key={method}
                        style={[
                          s.methodRow,
                          { borderBottomColor: theme.border },
                        ]}
                      >
                        <Text style={[s.methodName, { color: theme.text }]}>
                          {METHOD_LABELS[method] ?? method}
                        </Text>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text
                            style={[
                              s.methodAmount,
                              { color: ComeYaColors.success },
                            ]}
                          >
                            {(data.amount / 100).toFixed(2)} €
                          </Text>
                          <Text style={[s.sub, { color: theme.textSecondary }]}>
                            {data.count} pagos
                          </Text>
                        </View>
                      </View>
                    ),
                  )}
                </View>
              )}

            {/* Info */}
            <View
              style={[
                s.card,
                {
                  backgroundColor: ComeYaColors.primary + "10",
                  borderColor: ComeYaColors.primary + "30",
                  borderWidth: 1,
                },
              ]}
            >
              <Feather name="info" size={16} color={ComeYaColors.primary} />
              <Text
                style={[s.sub, { color: ComeYaColors.primary, marginTop: 6 }]}
              >
                Los pagos de pedidos pagados con tarjeta se liberan
                automáticamente vía Stripe Connect cuando el cliente confirma la
                entrega. Los pedidos pagados de forma manual (Bizum, IBAN,
                PayPal o efectivo) se registran aquí cuando realizas la
                transferencia al negocio o repartidor.
              </Text>
            </View>
          </>
        )}

        {/* ── PROPINAS MANUALES PENDIENTES ── */}
        {tab === "tips" && (
          <>
            <Text style={[s.cardTitle, { color: theme.text, marginBottom: 12 }]}>
              Propinas por pago manual (Bizum/PayPal)
            </Text>
            <Text style={[s.sub, { color: theme.textSecondary, marginBottom: 12 }]}>
              El cliente declaró la propina y adjuntó un comprobante. Verifica
              que el dinero llegó a la cuenta de la plataforma antes de
              aprobar: al aprobar se abona a la wallet del repartidor.
            </Text>
            {tipsLoading ? (
              <ActivityIndicator color={ComeYaColors.primary} />
            ) : pendingTips.length === 0 ? (
              <View style={s.empty}>
                <Feather
                  name="check-circle"
                  size={48}
                  color={ComeYaColors.success}
                />
                <Text style={[s.emptyText, { color: theme.textSecondary }]}>
                  No hay propinas pendientes de verificación
                </Text>
              </View>
            ) : (
              pendingTips.map((tip: any) => (
                <View key={tip.txId} style={s.card}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={[s.cardTitle, { color: theme.text, fontSize: 16 }]}
                    >
                      Propina {tip.orderRef ? `pedido ${tip.orderRef}` : ""}
                    </Text>
                    <Text
                      style={{
                        color: ComeYaColors.primary,
                        fontWeight: "700",
                        fontSize: 18,
                      }}
                    >
                      {fmt(tip.amountCents)}
                    </Text>
                  </View>
                  <Text style={[s.sub, { color: theme.textSecondary, marginTop: 4 }]}>
                    {tip.businessName
                      ? `Negocio: ${tip.businessName} · `
                      : ""}
                    Declarada{" "}
                    {tip.declaredAt
                      ? new Date(tip.declaredAt).toLocaleString("es-ES")
                      : ""}
                  </Text>
                  {!!tip.proofUrl && (
                    <Image
                      source={{ uri: tip.proofUrl }}
                      style={[s.proofImage, { height: 120 }]}
                      resizeMode="contain"
                    />
                  )}
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 8,
                      marginTop: 12,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => verifyTip(tip.txId)}
                      style={[
                        s.actionBtn,
                        { backgroundColor: ComeYaColors.success, flex: 1 },
                      ]}
                    >
                      <Text style={[s.actionBtnText, { color: "#fff" }]}>
                        Verificar y abonar
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => rejectTip(tip.txId)}
                      style={[
                        s.actionBtn,
                        { backgroundColor: theme.backgroundSecondary, flex: 1 },
                      ]}
                    >
                      <Text style={[s.actionBtnText, { color: theme.text }]}>
                        Rechazar
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {/* ── GANANCIAS MENSUALES POR REPARTIDOR ── */}
        {tab === "drivers" && (
          <>
            <Text style={[s.cardTitle, { color: theme.text, marginBottom: 12 }]}>
              Ganancias mensuales por repartidor
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <Feather name="calendar" size={16} color={theme.textSecondary} />
              <TextInput
                value={monthlyMonth}
                onChangeText={(v) => setMonthlyMonth(v)}
                placeholder="YYYY-MM"
                style={[
                  {
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    color: theme.text,
                    backgroundColor: theme.card,
                    minWidth: 110,
                  },
                ]}
              />
            </View>
            {monthlyError ? (
              <Text style={{ color: ComeYaColors.error }}>{monthlyError}</Text>
            ) : monthlyLoading ? (
              <ActivityIndicator color={ComeYaColors.primary} />
            ) : monthlyRows.length === 0 ? (
              <View style={s.empty}>
                <Feather name="users" size={48} color={ComeYaColors.primary} />
                <Text style={[s.emptyText, { color: theme.textSecondary }]}>
                  Sin entregas confirmadas en este mes
                </Text>
              </View>
            ) : (
              monthlyRows.map((r: any) => (
                <View key={r.driverId} style={s.card}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={[s.cardTitle, { color: theme.text, fontSize: 16 }]}
                    >
                      {r.driverName}
                    </Text>
                    <Text
                      style={{
                        color: ComeYaColors.primary,
                        fontWeight: "700",
                        fontSize: 18,
                      }}
                    >
                      {fmt(r.totalCents)}
                    </Text>
                  </View>
                  <View style={{ marginTop: 8 }}>
                    <Text style={[s.sub, { color: theme.textSecondary }]}>
                      {r.deliveries} entregas · Entregas: {fmt(r.feesCents)}
                    </Text>
                    <Text style={[s.sub, { color: theme.textSecondary }]}>
                      Propinas (plataforma): {fmt(r.platformTipsCents)}
                    </Text>
                    <Text style={[s.sub, { color: theme.textSecondary }]}>
                      Propinas en efectivo (en mano): {fmt(r.cashTipsCents)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

function KPI({ label, value, color, theme }: any) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color }}>{value}</Text>
      <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}

const st = (theme: any) =>
  StyleSheet.create({
    centered: { justifyContent: "center", alignItems: "center" },
    tabBar: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    tabBtn: { flex: 1, paddingVertical: 12, alignItems: "center" },
    tabBtnActive: {
      borderBottomWidth: 2,
      borderBottomColor: ComeYaColors.primary,
    },
    tabLabel: { fontSize: 13, color: theme.textSecondary, fontWeight: "500" },
    tabLabelActive: { color: ComeYaColors.primary, fontWeight: "700" },
    card: {
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      elevation: 2,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.07,
      shadowRadius: 3,
    },
    cardTitle: { fontSize: 15, fontWeight: "700" },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    badgeText: { fontSize: 12, fontWeight: "600" },
    amount: { fontSize: 20, fontWeight: "700" },
    name: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
    sub: { fontSize: 12, marginBottom: 2 },
    accountBox: { borderRadius: 8, padding: 10, marginBottom: 8 },
    accountLabel: { fontSize: 12, fontWeight: "700", marginBottom: 4 },
    accountValue: { fontSize: 13, marginBottom: 2 },
    input: {
      borderWidth: 1,
      borderRadius: 8,
      padding: 10,
      fontSize: 14,
      minHeight: 44,
    },
    btn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      padding: 14,
      borderRadius: 10,
      marginTop: 8,
    },
    btnText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
    backBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 16,
    },
    backText: { fontSize: 14 },
    tapHint: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 6,
    },
    tapHintText: { fontSize: 12 },
    empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
    emptyText: { fontSize: 15, fontWeight: "600" },
    methodRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
    },
    methodName: { fontSize: 14, fontWeight: "500" },
    methodAmount: { fontSize: 15, fontWeight: "700" },
    methodChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
    },
    proofImage: { width: "100%", height: 200, borderRadius: 8, marginTop: 8 },
    actionBtn: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    actionBtnText: { fontSize: 13, fontWeight: "700" },
    methodTag: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 6,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 6,
      alignSelf: "flex-start",
    },
  });
