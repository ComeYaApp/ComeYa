import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Image, RefreshControl, TextInput,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { ComeYaColors } from "../../../constants/theme";
import { apiRequest } from "@/lib/query-client";

interface FinanceTabProps {
  theme: any;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}

interface PaymentAccount {
  id: string;
  method: string;
  isDefault: boolean;
  pagoMovilPhone?: string | null;
  pagoMovilBank?: string | null;
  pagoMovilCedula?: string | null;
  binanceId?: string | null;
  binanceEmail?: string | null;
  zinliEmail?: string | null;
  zelleEmail?: string | null;
  zellePhone?: string | null;
  label?: string | null;
}

interface Payout {
  id: string;
  orderId: string;
  recipientId: string;
  recipientType: "business" | "driver";
  amount: number;
  method: string | null;
  accountSnapshot: string | null;
  status: "pending" | "paid";
  paidBy: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  recipientName?: string;
  paymentAccounts?: PaymentAccount[];
  paymentMethod?: string | null;
  deliveryMinutes?: number | null;
  orderTotal?: number | null;
  businessName?: string | null;
}

interface PaymentProof {
  id: string;
  orderId: string;
  userId: string;
  paymentProvider: string;
  proofImageUrl: string | null;
  referenceNumber: string | null;
  amount: number;
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
  customerName?: string;
}

interface Metrics {
  totalByMethod: Record<string, { count: number; amount: number }>;
  pendingProofs: number;
  approvedToday: number;
  rejectedToday: number;
  totalRevenue: number;
}

const METHOD_LABELS: Record<string, string> = {
  pago_movil: "Pago Móvil",
  binance: "Binance Pay",
  zinli: "Zinli",
  zelle: "Zelle",
  cash: "Efectivo",
  paypal: "PayPal",
};

export const FinanceTab: React.FC<FinanceTabProps> = ({ theme, showToast }) => {
  const [tab, setTab] = useState<"payouts" | "proofs" | "metrics">("payouts");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingPayouts, setPendingPayouts] = useState<Payout[]>([]);
  const [pendingProofs, setPendingProofs] = useState<PaymentProof[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [selectedProof, setSelectedProof] = useState<PaymentProof | null>(null);
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [payoutNotes, setPayoutNotes] = useState("");
  const [payoutProofBase64, setPayoutProofBase64] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const pickProofImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0].base64) {
      setPayoutProofBase64(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const load = useCallback(async () => {
    try {
      // Auto-sincronizar y corregir montos silenciosamente al cargar
      await Promise.allSettled([
        apiRequest("POST", "/api/admin/finance/payouts/backfill", {}),
        apiRequest("POST", "/api/admin/finance/payouts/fix-amounts", {}),
      ]);

      const [payoutsRes, proofsRes, metricsRes] = await Promise.all([
        apiRequest("GET", "/api/admin/finance/payouts/pending"),
        apiRequest("GET", "/api/digital-payments/proof/pending"),
        apiRequest("GET", "/api/digital-payments/metrics"),
      ]);

      const [payoutsData, proofsData, metricsData] = await Promise.all([
        payoutsRes.json(),
        proofsRes.json(),
        metricsRes.json(),
      ]);

      if (payoutsData.success) setPendingPayouts(payoutsData.payouts ?? []);
      if (proofsData.success) setPendingProofs(proofsData.proofs ?? []);
      if (metricsData.success) setMetrics(metricsData);
    } catch {
      showToast("Error al cargar datos financieros", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const markPayoutPaid = async (payout: Payout) => {
    setProcessingId(payout.id);
    try {
      const res = await apiRequest("POST", `/api/admin/finance/payouts/${payout.id}/mark-paid`, {
        notes: payoutNotes || undefined,
        proofUrl: payoutProofBase64 || undefined,
      });
      const data = await res.json();
      if (data.success) {
        setPendingPayouts(prev => prev.filter(p => p.id !== payout.id));
        setSelectedPayout(null);
        setPayoutNotes("");
        setPayoutProofBase64(null);
        showToast("Pago registrado correctamente", "success");
      } else {
        showToast(data.error ?? "Error al procesar", "error");
      }
    } catch {
      showToast("Error de conexión", "error");
    } finally {
      setProcessingId(null);
    }
  };

  const verifyProof = async (proofId: string, approved: boolean) => {
    setProcessingId(proofId);
    try {
      const res = await apiRequest("POST", "/api/digital-payments/proof/verify", { proofId, approved });
      const data = await res.json();
      if (data.success) {
        setPendingProofs(prev => prev.filter(p => p.id !== proofId));
        setSelectedProof(null);
        showToast(approved ? "Comprobante aprobado" : "Comprobante rechazado", approved ? "success" : "info");
      } else {
        showToast(data.error ?? "Error al verificar", "error");
      }
    } catch {
      showToast("Error de conexión", "error");
    } finally {
      setProcessingId(null);
    }
  };

  const s = styles(theme);

  if (loading) {
    return (
      <View style={[s.centered, { backgroundColor: theme.background, flex: 1 }]}>
        <ActivityIndicator size="large" color={ComeYaColors.primary} />
      </View>
    );
  }

  // ── DETALLE DE PAYOUT ──
  if (selectedPayout) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: theme.background }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => { setSelectedPayout(null); setPayoutNotes(""); setPayoutProofBase64(null); }}
        >
          <Feather name="arrow-left" size={18} color={theme.text} />
          <Text style={[s.backText, { color: theme.text }]}>{"Volver a la lista"}</Text>
        </TouchableOpacity>

        {/* Resumen del payout */}
        <View style={s.card}>
          <View style={s.row}>
            <View style={[s.badge, { backgroundColor: selectedPayout.recipientType === "business" ? ComeYaColors.primary + "20" : ComeYaColors.warning + "20" }]}>
              <Text style={[s.badgeText, { color: selectedPayout.recipientType === "business" ? ComeYaColors.primary : ComeYaColors.warning }]}>
                {selectedPayout.recipientType === "business" ? "Negocio" : "Repartidor"}
              </Text>
            </View>
            <Text style={[s.amount, { color: ComeYaColors.success }]}>
              {"Bs. " + selectedPayout.amount.toFixed(2)}
            </Text>
          </View>
          <Text style={[s.name, { color: theme.text }]}>{selectedPayout.recipientName ?? ""}</Text>
          {selectedPayout.businessName && selectedPayout.recipientType === "driver" && (
            <Text style={[s.sub, { color: theme.textSecondary }]}>{"Negocio: " + selectedPayout.businessName}</Text>
          )}
          <Text style={[s.sub, { color: theme.textSecondary }]}>
            {"Pedido #" + selectedPayout.orderId.slice(0, 8) + " · " + new Date(selectedPayout.createdAt).toLocaleDateString("es-VE")}
          </Text>
          {selectedPayout.paymentMethod ? (
            <Text style={[s.sub, { color: theme.textSecondary }]}>
              {"Método del cliente: " + (METHOD_LABELS[selectedPayout.paymentMethod] ?? selectedPayout.paymentMethod) +
                (selectedPayout.orderTotal ? "  ·  Total pedido: Bs. " + selectedPayout.orderTotal.toFixed(2) : "")}
            </Text>
          ) : null}
          {selectedPayout.deliveryMinutes != null ? (
            <Text style={[s.sub, { color: theme.textSecondary }]}>{"Tiempo de entrega: " + selectedPayout.deliveryMinutes + " min"}</Text>
          ) : null}
        </View>

        {/* Cuentas de pago del recipiente */}
        <View style={s.card}>
          <Text style={[s.cardTitle, { color: theme.text, marginBottom: 10 }]}>{"Cuentas de pago registradas"}</Text>
          {selectedPayout.paymentAccounts && selectedPayout.paymentAccounts.length > 0 ? (
            selectedPayout.paymentAccounts.map(acc => (
              <View key={acc.id} style={[s.accountBox, { backgroundColor: theme.background }]}>
                <Text style={[s.accountValue, { color: theme.text, fontWeight: "700" }]}>
                  {(METHOD_LABELS[acc.method] ?? acc.method) + (acc.isDefault ? " ✓ (principal)" : "") + (acc.label ? " · " + acc.label : "")}
                </Text>
                {acc.pagoMovilPhone ? (
                  <Text style={[s.accountValue, { color: theme.text }]}>
                    {"Tel: " + acc.pagoMovilPhone + "  ·  Banco: " + (acc.pagoMovilBank ?? "") + "  ·  CI: " + (acc.pagoMovilCedula ?? "")}
                  </Text>
                ) : null}
                {acc.binanceId ? (
                  <Text style={[s.accountValue, { color: theme.text }]}>{"Binance ID: " + acc.binanceId}</Text>
                ) : null}
                {acc.binanceEmail ? (
                  <Text style={[s.accountValue, { color: theme.text }]}>{"Binance email: " + acc.binanceEmail}</Text>
                ) : null}
                {acc.zinliEmail ? (
                  <Text style={[s.accountValue, { color: theme.text }]}>{"Zinli: " + acc.zinliEmail}</Text>
                ) : null}
                {acc.zelleEmail ? (
                  <Text style={[s.accountValue, { color: theme.text }]}>{"Zelle email: " + acc.zelleEmail}</Text>
                ) : null}
                {acc.zellePhone ? (
                  <Text style={[s.accountValue, { color: theme.text }]}>{"Zelle tel: " + acc.zellePhone}</Text>
                ) : null}
              </View>
            ))
          ) : (
            <Text style={[s.sub, { color: ComeYaColors.warning }]}>{"⚠️ Sin cuentas de pago registradas"}</Text>
          )}
        </View>

        {/* Registrar la transferencia */}
        <View style={s.card}>
          <Text style={[s.cardTitle, { color: theme.text, marginBottom: 10 }]}>{"Registrar transferencia realizada"}</Text>
          <Text style={[s.sub, { color: theme.textSecondary, marginBottom: 4 }]}>{"Notas / referencia de la transferencia:"}</Text>
          <TextInput
            style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
            placeholder={"Ej: Pago Móvil ref. 123456 · Banesco"}
            placeholderTextColor={theme.textSecondary}
            value={payoutNotes}
            onChangeText={setPayoutNotes}
            multiline
            numberOfLines={3}
          />
          <Text style={[s.sub, { color: theme.textSecondary, marginBottom: 4, marginTop: 12 }]}>{"Capture de la transferencia (opcional):"}</Text>
          {payoutProofBase64 ? (
            <View>
              <Image source={{ uri: payoutProofBase64 }} style={s.proofImage} resizeMode="contain" />
              <TouchableOpacity
                style={[s.btn, { backgroundColor: theme.border, marginTop: 4 }]}
                onPress={() => setPayoutProofBase64(null)}
              >
                <Feather name="trash-2" size={14} color={theme.text} />
                <Text style={[s.btnText, { color: theme.text }]}>{"Quitar imagen"}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[s.btn, { backgroundColor: theme.border }]}
              onPress={pickProofImage}
            >
              <Feather name="camera" size={16} color={theme.text} />
              <Text style={[s.btnText, { color: theme.text }]}>{"Subir capture de transferencia"}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Botón confirmar */}
        <TouchableOpacity
          style={[s.btn, { backgroundColor: ComeYaColors.success }]}
          onPress={() => markPayoutPaid(selectedPayout)}
          disabled={processingId === selectedPayout.id}
        >
          {processingId === selectedPayout.id
            ? <ActivityIndicator size="small" color="#FFF" />
            : (
              <>
                <Feather name="check-circle" size={16} color="#FFF" />
                <Text style={s.btnText}>{"Confirmar pago realizado"}</Text>
              </>
            )
          }
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Tabs */}
      <View style={s.tabBar}>
        {(["payouts", "proofs", "metrics"] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[s.tabBtn, tab === t && s.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[s.tabLabel, tab === t && s.tabLabelActive]}>
              {t === "payouts" ? ("Payouts" + (pendingPayouts.length ? " (" + pendingPayouts.length + ")" : "")) :
               t === "proofs" ? ("Comprobantes" + (pendingProofs.length ? " (" + pendingProofs.length + ")" : "")) :
               "Métricas"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {/* ── PAYOUTS ── */}
        {tab === "payouts" && (
          <>
            {pendingPayouts.length === 0 ? (
              <View style={s.empty}>
                <Feather name="check-circle" size={48} color={ComeYaColors.success} />
                <Text style={[s.emptyText, { color: theme.textSecondary }]}>{"Sin payouts pendientes"}</Text>
              </View>
            ) : (
              pendingPayouts.map(payout => (
                <TouchableOpacity
                  key={payout.id}
                  style={s.card}
                  onPress={() => { setSelectedPayout(payout); setPayoutNotes(""); setPayoutProofBase64(null); }}
                >
                  <View style={s.row}>
                    <View style={[s.badge, { backgroundColor: payout.recipientType === "business" ? ComeYaColors.primary + "20" : ComeYaColors.warning + "20" }]}>
                      <Text style={[s.badgeText, { color: payout.recipientType === "business" ? ComeYaColors.primary : ComeYaColors.warning }]}>
                        {payout.recipientType === "business" ? "Negocio" : "Repartidor"}
                      </Text>
                    </View>
                    <Text style={[s.amount, { color: ComeYaColors.success }]}>
                      {"Bs. " + payout.amount.toFixed(2)}
                    </Text>
                  </View>
                  <Text style={[s.name, { color: theme.text }]}>{payout.recipientName ?? ""}</Text>
                  {payout.businessName && payout.recipientType === "driver" ? (
                    <Text style={[s.sub, { color: theme.textSecondary }]}>{"Negocio: " + payout.businessName}</Text>
                  ) : null}
                  <Text style={[s.sub, { color: theme.textSecondary }]}>
                    {"Pedido #" + payout.orderId.slice(0, 8) + " · " + new Date(payout.createdAt).toLocaleDateString("es-VE")}
                  </Text>
                  <View style={s.tapHint}>
                    <Feather name="eye" size={14} color={ComeYaColors.primary} />
                    <Text style={[s.tapHintText, { color: ComeYaColors.primary }]}>{"Ver datos y registrar pago"}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        {/* ── COMPROBANTES ── */}
        {tab === "proofs" && (
          <>
            {selectedProof ? (
              <View style={s.card}>
                <TouchableOpacity onPress={() => setSelectedProof(null)} style={s.backBtn}>
                  <Feather name="arrow-left" size={18} color={theme.text} />
                  <Text style={[s.backText, { color: theme.text }]}>{"Volver"}</Text>
                </TouchableOpacity>
                <Text style={[s.name, { color: theme.text }]}>
                  {METHOD_LABELS[selectedProof.paymentProvider] ?? selectedProof.paymentProvider}
                </Text>
                <Text style={[s.sub, { color: theme.textSecondary }]}>
                  {"Pedido #" + selectedProof.orderId.slice(0, 8)}
                </Text>
                <Text style={[s.amount, { color: ComeYaColors.success }]}>
                  {"Bs. " + selectedProof.amount.toFixed(2)}
                </Text>
                {selectedProof.referenceNumber ? (
                  <Text style={[s.sub, { color: theme.textSecondary }]}>{"Ref: " + selectedProof.referenceNumber}</Text>
                ) : null}
                {selectedProof.proofImageUrl ? (
                  <Image source={{ uri: selectedProof.proofImageUrl }} style={s.proofImage} resizeMode="contain" />
                ) : null}
                <View style={s.row}>
                  <TouchableOpacity
                    style={[s.btn, { flex: 1, backgroundColor: ComeYaColors.error }]}
                    onPress={() => verifyProof(selectedProof.id, false)}
                    disabled={!!processingId}
                  >
                    {processingId === selectedProof.id
                      ? <ActivityIndicator size="small" color="#FFF" />
                      : <><Feather name="x" size={16} color="#FFF" /><Text style={s.btnText}>{"Rechazar"}</Text></>
                    }
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.btn, { flex: 1, backgroundColor: ComeYaColors.success }]}
                    onPress={() => verifyProof(selectedProof.id, true)}
                    disabled={!!processingId}
                  >
                    {processingId === selectedProof.id
                      ? <ActivityIndicator size="small" color="#FFF" />
                      : <><Feather name="check" size={16} color="#FFF" /><Text style={s.btnText}>{"Aprobar"}</Text></>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            ) : pendingProofs.length === 0 ? (
              <View style={s.empty}>
                <Feather name="check-circle" size={48} color={ComeYaColors.success} />
                <Text style={[s.emptyText, { color: theme.textSecondary }]}>{"Sin comprobantes pendientes"}</Text>
              </View>
            ) : (
              pendingProofs.map(proof => (
                <TouchableOpacity key={proof.id} style={s.card} onPress={() => setSelectedProof(proof)}>
                  <View style={s.row}>
                    <View style={[s.badge, { backgroundColor: ComeYaColors.warning + "20" }]}>
                      <Text style={[s.badgeText, { color: ComeYaColors.warning }]}>{"Pendiente"}</Text>
                    </View>
                    <Text style={[s.amount, { color: ComeYaColors.success }]}>
                      {"Bs. " + proof.amount.toFixed(2)}
                    </Text>
                  </View>
                  <Text style={[s.name, { color: theme.text }]}>
                    {METHOD_LABELS[proof.paymentProvider] ?? proof.paymentProvider}
                  </Text>
                  <Text style={[s.sub, { color: theme.textSecondary }]}>
                    {"Pedido #" + proof.orderId.slice(0, 8) + " · " + (proof.referenceNumber ? "Ref: " + proof.referenceNumber : "Sin referencia")}
                  </Text>
                  <Text style={[s.sub, { color: theme.textSecondary }]}>
                    {new Date(proof.submittedAt).toLocaleString("es-VE")}
                  </Text>
                  <View style={s.tapHint}>
                    <Feather name="eye" size={14} color={ComeYaColors.primary} />
                    <Text style={[s.tapHintText, { color: ComeYaColors.primary }]}>{"Ver comprobante"}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        {/* ── MÉTRICAS ── */}
        {tab === "metrics" && metrics && (
          <>
            <View style={s.card}>
              <View style={s.cardHeader}>
                <Feather name="bar-chart-2" size={20} color={ComeYaColors.primary} />
                <Text style={[s.cardTitle, { color: theme.text }]}>{"Resumen de pagos"}</Text>
              </View>
              <View style={s.metricsGrid}>
                <View style={s.metricItem}>
                  <Text style={[s.metricValue, { color: ComeYaColors.warning }]}>{metrics.pendingProofs}</Text>
                  <Text style={[s.metricLabel, { color: theme.textSecondary }]}>{"Pendientes"}</Text>
                </View>
                <View style={s.metricItem}>
                  <Text style={[s.metricValue, { color: ComeYaColors.success }]}>{metrics.approvedToday}</Text>
                  <Text style={[s.metricLabel, { color: theme.textSecondary }]}>{"Aprobados hoy"}</Text>
                </View>
                <View style={s.metricItem}>
                  <Text style={[s.metricValue, { color: ComeYaColors.error }]}>{metrics.rejectedToday}</Text>
                  <Text style={[s.metricLabel, { color: theme.textSecondary }]}>{"Rechazados hoy"}</Text>
                </View>
              </View>
            </View>
            <View style={s.card}>
              <View style={s.cardHeader}>
                <Feather name="pie-chart" size={20} color={ComeYaColors.primary} />
                <Text style={[s.cardTitle, { color: theme.text }]}>{"Por método de pago"}</Text>
              </View>
              {metrics.totalByMethod && Object.entries(metrics.totalByMethod).map(([method, data]) => (
                <View key={method} style={[s.methodRow, { borderBottomColor: theme.border }]}>
                  <Text style={[s.methodName, { color: theme.text }]}>
                    {METHOD_LABELS[method] ?? method}
                  </Text>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[s.methodAmount, { color: ComeYaColors.success }]}>
                      {"Bs. " + data.amount.toFixed(2)}
                    </Text>
                    <Text style={[s.sub, { color: theme.textSecondary }]}>{data.count + " pagos"}</Text>
                  </View>
                </View>
              ))}
              {(!metrics.totalByMethod || Object.keys(metrics.totalByMethod).length === 0) && (
                <Text style={[s.sub, { color: theme.textSecondary }]}>{"Sin datos aún"}</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = (theme: any) => StyleSheet.create({
  centered: { justifyContent: "center", alignItems: "center" },
  tabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: theme.border },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: ComeYaColors.primary },
  tabLabel: { fontSize: 13, color: theme.textSecondary, fontWeight: "500" },
  tabLabelActive: { color: ComeYaColors.primary, fontWeight: "700" },
  card: {
    backgroundColor: theme.card, borderRadius: 12, padding: 16,
    marginBottom: 12, elevation: 2,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: "600" },
  amount: { fontSize: 20, fontWeight: "700" },
  name: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  sub: { fontSize: 12, marginBottom: 2 },
  accountBox: { borderRadius: 8, padding: 10, marginBottom: 8 },
  accountLabel: { fontSize: 11, fontWeight: "600", marginBottom: 4 },
  accountValue: { fontSize: 13, marginBottom: 2 },
  input: {
    borderWidth: 1, borderRadius: 8, padding: 10,
    fontSize: 14, minHeight: 44,
  },
  btn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, padding: 12, borderRadius: 8, marginTop: 8,
  },
  btnText: { color: "#FFF", fontSize: 14, fontWeight: "600" },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 16 },
  backText: { fontSize: 14 },
  proofImage: { width: "100%", height: 250, borderRadius: 8, marginVertical: 12, backgroundColor: theme.background },
  tapHint: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  tapHintText: { fontSize: 12 },
  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 14 },
  metricsGrid: { flexDirection: "row", justifyContent: "space-around" },
  metricItem: { alignItems: "center" },
  metricValue: { fontSize: 28, fontWeight: "700" },
  metricLabel: { fontSize: 11, marginTop: 2 },
  methodRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1 },
  methodName: { fontSize: 14, fontWeight: "500" },
  methodAmount: { fontSize: 15, fontWeight: "700" },
});
