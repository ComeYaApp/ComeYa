import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput,
} from "react-native";
import { Feather } from "@expo/vector-icons";
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
  status: "pending" | "paid";
  paidBy: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  recipientName?: string;
  paymentAccounts?: any[];
  businessName?: string | null;
}

// Métodos de pago España
const METHOD_LABELS: Record<string, string> = {
  bizum:         "Bizum",
  transferencia: "Transferencia IBAN",
  paypal:        "PayPal",
  stripe_card:   "Tarjeta (Stripe)",
  stripe_bizum:  "Bizum (Stripe)",
  cash:          "Efectivo",
};

const fmt = (cents: number) => `€${(cents / 100).toFixed(2)}`;

export const FinanceTab: React.FC<Props> = ({ theme, showToast }) => {
  const [tab, setTab]                   = useState<"payouts" | "metrics">("payouts");
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [pendingPayouts, setPendingPayouts] = useState<Payout[]>([]);
  const [metrics, setMetrics]           = useState<any>(null);
  const [selected, setSelected]         = useState<Payout | null>(null);
  const [notes, setNotes]               = useState("");
  const [processing, setProcessing]     = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [payoutsRes, metricsRes] = await Promise.all([
        apiRequest("GET", "/api/admin/finance/payouts/pending"),
        apiRequest("GET", "/api/digital-payments/metrics"),
      ]);
      const [payoutsData, metricsData] = await Promise.all([
        payoutsRes.json(),
        metricsRes.json(),
      ]);
      if (payoutsData.success) setPendingPayouts(payoutsData.payouts ?? []);
      if (metricsData.success) setMetrics(metricsData);
    } catch {
      showToast("Error al cargar datos financieros", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const markPaid = async (payout: Payout) => {
    setProcessing(payout.id);
    try {
      const res  = await apiRequest("POST", `/api/admin/finance/payouts/${payout.id}/mark-paid`, { notes: notes || undefined });
      const data = await res.json();
      if (data.success) {
        setPendingPayouts(prev => prev.filter(p => p.id !== payout.id));
        setSelected(null);
        setNotes("");
        showToast("Pago registrado correctamente ✓", "success");
      } else {
        showToast(data.error ?? "Error al procesar", "error");
      }
    } catch {
      showToast("Error de conexión", "error");
    } finally {
      setProcessing(null);
    }
  };

  const s = st(theme);

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
    const snap = selected.accountSnapshot ? (() => { try { return JSON.parse(selected.accountSnapshot!); } catch { return null; } })() : null;

    return (
      <ScrollView style={{ flex: 1, backgroundColor: theme.backgroundRoot }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <TouchableOpacity style={s.backBtn} onPress={() => { setSelected(null); setNotes(""); }}>
          <Feather name="arrow-left" size={18} color={theme.text} />
          <Text style={[s.backText, { color: theme.text }]}>Volver a la lista</Text>
        </TouchableOpacity>

        {/* Resumen */}
        <View style={s.card}>
          <View style={s.row}>
            <View style={[s.badge, { backgroundColor: selected.recipientType === "business" ? ComeYaColors.primary + "20" : ComeYaColors.warning + "20" }]}>
              <Text style={[s.badgeText, { color: selected.recipientType === "business" ? ComeYaColors.primary : ComeYaColors.warning }]}>
                {selected.recipientType === "business" ? "Negocio" : "Repartidor"}
              </Text>
            </View>
            <Text style={[s.amount, { color: ComeYaColors.success }]}>{fmt(selected.amount)}</Text>
          </View>
          <Text style={[s.name, { color: theme.text }]}>{selected.recipientName ?? "—"}</Text>
          {selected.businessName && selected.recipientType === "driver" && (
            <Text style={[s.sub, { color: theme.textSecondary }]}>Negocio: {selected.businessName}</Text>
          )}
          <Text style={[s.sub, { color: theme.textSecondary }]}>
            Pedido #{selected.orderId.slice(0, 8)} · {new Date(selected.createdAt).toLocaleDateString("es-ES")}
          </Text>
        </View>

        {/* Cuentas de pago registradas */}
        <View style={s.card}>
          <Text style={[s.cardTitle, { color: theme.text }]}>Cuenta para recibir el pago</Text>

          {/* Snapshot de la cuenta usada al crear el payout */}
          {snap && (
            <View style={[s.accountBox, { backgroundColor: theme.backgroundSecondary }]}>
              <Text style={[s.accountLabel, { color: ComeYaColors.primary }]}>
                {METHOD_LABELS[snap.method] ?? snap.method} {snap.isDefault ? "✓ (principal)" : ""}
              </Text>
              {snap.pagoMovilPhone && <Text style={[s.accountValue, { color: theme.text }]}>Bizum: {snap.pagoMovilPhone}</Text>}
              {snap.binanceId      && <Text style={[s.accountValue, { color: theme.text }]}>IBAN: {snap.binanceId}</Text>}
              {snap.zelleEmail     && <Text style={[s.accountValue, { color: theme.text }]}>Titular: {snap.zelleEmail}</Text>}
              {snap.zinliEmail     && <Text style={[s.accountValue, { color: theme.text }]}>Titular tarjeta: {snap.zinliEmail}</Text>}
              {snap.zellePhone     && <Text style={[s.accountValue, { color: theme.text }]}>Últimos 4: **** {snap.zellePhone}</Text>}
            </View>
          )}

          {/* Todas las cuentas del usuario */}
          {accounts.length > 0 && (
            <>
              <Text style={[s.sub, { color: theme.textSecondary, marginTop: 8, marginBottom: 4 }]}>Todas sus cuentas:</Text>
              {accounts.map((acc: any) => (
                <View key={acc.id} style={[s.accountBox, { backgroundColor: theme.backgroundSecondary }]}>
                  <Text style={[s.accountLabel, { color: theme.text }]}>
                    {METHOD_LABELS[acc.method] ?? acc.method}{acc.isDefault ? " ✓" : ""}
                  </Text>
                  {acc.pagoMovilPhone && <Text style={[s.accountValue, { color: theme.text }]}>Bizum: {acc.pagoMovilPhone}</Text>}
                  {acc.binanceId      && <Text style={[s.accountValue, { color: theme.text }]}>IBAN: {acc.binanceId}</Text>}
                  {acc.zelleEmail     && <Text style={[s.accountValue, { color: theme.text }]}>Titular / PayPal: {acc.zelleEmail}</Text>}
                  {acc.zinliEmail     && <Text style={[s.accountValue, { color: theme.text }]}>Titular tarjeta: {acc.zinliEmail}</Text>}
                  {acc.zellePhone     && <Text style={[s.accountValue, { color: theme.text }]}>Últimos 4: **** {acc.zellePhone}</Text>}
                </View>
              ))}
            </>
          )}

          {!snap && accounts.length === 0 && (
            <Text style={[s.sub, { color: ComeYaColors.warning }]}>⚠️ Sin cuentas de pago registradas</Text>
          )}
        </View>

        {/* Registrar transferencia */}
        <View style={s.card}>
          <Text style={[s.cardTitle, { color: theme.text }]}>Registrar transferencia realizada</Text>
          <Text style={[s.sub, { color: theme.textSecondary, marginBottom: 6 }]}>
            Referencia de la transferencia (opcional):
          </Text>
          <TextInput
            style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}
            placeholder="Ej: Bizum ref. 123456 · o IBAN transferencia"
            placeholderTextColor={theme.textSecondary}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
        </View>

        <TouchableOpacity
          style={[s.btn, { backgroundColor: ComeYaColors.success }]}
          onPress={() => markPaid(selected)}
          disabled={processing === selected.id}
        >
          {processing === selected.id
            ? <ActivityIndicator size="small" color="#FFF" />
            : <><Feather name="check-circle" size={16} color="#FFF" /><Text style={s.btnText}>Confirmar pago realizado</Text></>
          }
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── Lista principal ────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      {/* Tabs */}
      <View style={s.tabBar}>
        {(["payouts", "metrics"] as const).map(t => (
          <TouchableOpacity key={t} style={[s.tabBtn, tab === t && s.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabLabel, tab === t && s.tabLabelActive]}>
              {t === "payouts"
                ? `Pagos pendientes${pendingPayouts.length ? ` (${pendingPayouts.length})` : ""}`
                : "Métricas"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={ComeYaColors.primary} />}
      >
        {/* ── PAYOUTS ── */}
        {tab === "payouts" && (
          pendingPayouts.length === 0 ? (
            <View style={s.empty}>
              <Feather name="check-circle" size={48} color={ComeYaColors.success} />
              <Text style={[s.emptyText, { color: theme.textSecondary }]}>Sin pagos pendientes</Text>
              <Text style={[s.sub, { color: theme.textSecondary, textAlign: "center" }]}>
                Los pagos se generan automáticamente cuando el cliente confirma la entrega
              </Text>
            </View>
          ) : (
            pendingPayouts.map(payout => (
              <TouchableOpacity
                key={payout.id}
                style={s.card}
                onPress={() => { setSelected(payout); setNotes(""); }}
              >
                <View style={s.row}>
                  <View style={[s.badge, { backgroundColor: payout.recipientType === "business" ? ComeYaColors.primary + "20" : ComeYaColors.warning + "20" }]}>
                    <Text style={[s.badgeText, { color: payout.recipientType === "business" ? ComeYaColors.primary : ComeYaColors.warning }]}>
                      {payout.recipientType === "business" ? "Negocio" : "Repartidor"}
                    </Text>
                  </View>
                  <Text style={[s.amount, { color: ComeYaColors.success }]}>{fmt(payout.amount)}</Text>
                </View>
                <Text style={[s.name, { color: theme.text }]}>{payout.recipientName ?? "—"}</Text>
                {payout.businessName && payout.recipientType === "driver" && (
                  <Text style={[s.sub, { color: theme.textSecondary }]}>Negocio: {payout.businessName}</Text>
                )}
                <Text style={[s.sub, { color: theme.textSecondary }]}>
                  Pedido #{payout.orderId.slice(0, 8)} · {new Date(payout.createdAt).toLocaleDateString("es-ES")}
                </Text>
                <View style={s.tapHint}>
                  <Feather name="send" size={13} color={ComeYaColors.primary} />
                  <Text style={[s.tapHintText, { color: ComeYaColors.primary }]}>Ver cuenta y registrar pago</Text>
                </View>
              </TouchableOpacity>
            ))
          )
        )}

        {/* ── MÉTRICAS ── */}
        {tab === "metrics" && (
          <>
            {/* KPIs */}
            <View style={[s.card, { flexDirection: "row", justifyContent: "space-around" }]}>
              <KPI label="Pendientes"   value={pendingPayouts.length}                                  color={ComeYaColors.warning} theme={theme} />
              <KPI label="Total €"      value={fmt(pendingPayouts.reduce((s, p) => s + p.amount, 0))} color={ComeYaColors.success} theme={theme} />
              <KPI label="Negocios"     value={pendingPayouts.filter(p => p.recipientType === "business").length} color={ComeYaColors.primary} theme={theme} />
              <KPI label="Repartidores" value={pendingPayouts.filter(p => p.recipientType === "driver").length}   color="#9C27B0" theme={theme} />
            </View>

            {/* Por método de pago */}
            {metrics?.totalByMethod && Object.keys(metrics.totalByMethod).length > 0 && (
              <View style={s.card}>
                <Text style={[s.cardTitle, { color: theme.text, marginBottom: 12 }]}>Por método de pago</Text>
                {Object.entries(metrics.totalByMethod).map(([method, data]: any) => (
                  <View key={method} style={[s.methodRow, { borderBottomColor: theme.border }]}>
                    <Text style={[s.methodName, { color: theme.text }]}>{METHOD_LABELS[method] ?? method}</Text>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[s.methodAmount, { color: ComeYaColors.success }]}>€{(data.amount / 100).toFixed(2)}</Text>
                      <Text style={[s.sub, { color: theme.textSecondary }]}>{data.count} pagos</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Info */}
            <View style={[s.card, { backgroundColor: ComeYaColors.primary + "10", borderColor: ComeYaColors.primary + "30", borderWidth: 1 }]}>
              <Feather name="info" size={16} color={ComeYaColors.primary} />
              <Text style={[s.sub, { color: ComeYaColors.primary, marginTop: 6 }]}>
                Los pagos a negocios y repartidores se realizan manualmente via Bizum, Transferencia IBAN o PayPal según la cuenta que hayan configurado en su perfil.
              </Text>
            </View>
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
      <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

const st = (theme: any) => StyleSheet.create({
  centered:      { justifyContent: "center", alignItems: "center" },
  tabBar:        { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: theme.border },
  tabBtn:        { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabBtnActive:  { borderBottomWidth: 2, borderBottomColor: ComeYaColors.primary },
  tabLabel:      { fontSize: 13, color: theme.textSecondary, fontWeight: "500" },
  tabLabelActive:{ color: ComeYaColors.primary, fontWeight: "700" },
  card:          { backgroundColor: theme.card, borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 3 },
  cardTitle:     { fontSize: 15, fontWeight: "700" },
  row:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  badge:         { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText:     { fontSize: 12, fontWeight: "600" },
  amount:        { fontSize: 20, fontWeight: "700" },
  name:          { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  sub:           { fontSize: 12, marginBottom: 2 },
  accountBox:    { borderRadius: 8, padding: 10, marginBottom: 8 },
  accountLabel:  { fontSize: 12, fontWeight: "700", marginBottom: 4 },
  accountValue:  { fontSize: 13, marginBottom: 2 },
  input:         { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14, minHeight: 44 },
  btn:           { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 14, borderRadius: 10, marginTop: 8 },
  btnText:       { color: "#FFF", fontSize: 14, fontWeight: "700" },
  backBtn:       { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 16 },
  backText:      { fontSize: 14 },
  tapHint:       { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  tapHintText:   { fontSize: 12 },
  empty:         { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText:     { fontSize: 15, fontWeight: "600" },
  methodRow:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1 },
  methodName:    { fontSize: 14, fontWeight: "500" },
  methodAmount:  { fontSize: 15, fontWeight: "700" },
});
