import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Text, TextInput, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { ComeYaColors, Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useResponsive } from "@/hooks/useResponsive";

type Period = "today" | "week" | "month";

export default function DeliveryEarningsScreen() {
  const navigation = useNavigation<any>();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { isMobile } = useResponsive();

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const inputBg = isDark ? "#2a2a2a" : "#f5f5f5";

  const [selectedPeriod, setSelectedPeriod] = useState<Period>("week");
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const { data: statsData, isLoading } = useQuery<any>({ queryKey: ["/api/delivery/stats"], enabled: !!user?.id });
  const { data: walletData, refetch: refetchWallet } = useQuery<any>({ queryKey: ["/api/wallet/balance"], enabled: !!user?.id });
  const { data: txData } = useQuery<any>({ queryKey: ["/api/wallet/transactions"], enabled: !!user?.id });

  const withdrawMutation = useMutation({
    mutationFn: async (amount: number) => {
      const res = await apiRequest("POST", "/api/wallet/withdraw", { amount: Math.round(amount * 100) });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        showToast("Solicitud de retiro enviada", "success");
        setShowWithdrawModal(false);
        setWithdrawAmount("");
        queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
        queryClient.invalidateQueries({ queryKey: ["/api/wallet/transactions"] });
      } else {
        showToast(data.error || "No se pudo procesar el retiro", "error");
      }
    },
    onError: () => showToast("Error al procesar el retiro", "error"),
  });

  const stats = statsData?.stats || {};
  const wallet = {
    balance: (walletData?.wallet?.balance ?? 0) / 100,
    cashOwed: (walletData?.wallet?.cashOwed ?? 0) / 100,
    canWithdraw: Math.max(0, ((walletData?.wallet?.balance ?? 0) - (walletData?.wallet?.cashOwed ?? 0))) / 100,
    totalEarned: (walletData?.wallet?.totalEarned ?? 0) / 100,
  };
  const transactions = txData?.transactions || [];

  const earnings = {
    today: (stats.todayEarnings || 0) / 100,
    week: (stats.weekEarnings || 0) / 100,
    month: (stats.monthEarnings || 0) / 100,
  };

  const periodLabels: Record<Period, string> = { today: "Hoy", week: "Esta semana", month: "Este mes" };

  const getTransactionColor = (type: string) => {
    if (["income", "delivery_income", "cash_income"].includes(type)) return ComeYaColors.success;
    if (type === "withdrawal") return ComeYaColors.warning;
    if (["cash_debt", "cash_debt_ComeYa"].includes(type)) return ComeYaColors.error;
    return sub;
  };

  const handleWithdraw = () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) { showToast("Ingresa un monto válido", "error"); return; }
    if (amount > wallet.canWithdraw) { showToast("Saldo insuficiente", "error"); return; }
    if (amount < 50) { showToast("Mínimo €50", "error"); return; }
    withdrawMutation.mutate(amount);
  };

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      {!isMobile && <View style={[s.sidebar, { backgroundColor: card, borderRightColor: border }]}>
        {/* Wallet card */}
        <View style={[s.walletCard, { backgroundColor: wallet.cashOwed > 0 ? ComeYaColors.error : ComeYaColors.success }]}>
          <Text style={s.walletLabel}>{wallet.cashOwed > 0 ? "🚨 Debes depositar" : "✅ Disponible"}</Text>
          <Text style={s.walletAmount}>€{wallet.cashOwed > 0 ? wallet.cashOwed.toFixed(2) : wallet.canWithdraw.toFixed(2)}</Text>
          <Pressable
            onPress={() => setShowWithdrawModal(true)}
            style={s.withdrawBtn}
          >
            <Feather name="arrow-up-circle" size={16} color={wallet.cashOwed > 0 ? "#fff" : ComeYaColors.success} />
            <Text style={[s.withdrawBtnText, { color: wallet.cashOwed > 0 ? "#fff" : ComeYaColors.success }]}>
              {wallet.cashOwed > 0 ? "Ver datos depósito" : "Solicitar retiro"}
            </Text>
          </Pressable>
        </View>

        {/* Stats rápidas */}
        <View style={[s.quickStats, { borderColor: border }]}>
          {[
            { label: "Entregas", value: stats.totalDeliveries || 0, icon: "truck", color: "#4CAF50" },
            { label: "Rating", value: (stats.rating || 0).toFixed(1), icon: "star", color: "#FF9800" },
            { label: "Completadas", value: `${stats.completionRate || 100}%`, icon: "check-circle", color: "#2196F3" },
          ].map((st, i) => (
            <View key={i} style={s.quickStat}>
              <Feather name={st.icon as any} size={18} color={st.color} />
              <Text style={[s.quickStatValue, { color: text }]}>{st.value}</Text>
              <Text style={[s.quickStatLabel, { color: sub }]}>{st.label}</Text>
            </View>
          ))}
        </View>

        <Text style={[s.totalEarned, { color: ComeYaColors.primary }]}>€{wallet.totalEarned.toFixed(2)}</Text>
        <Text style={[s.totalEarnedLabel, { color: sub }]}>Total ganado histórico</Text>

        <Pressable onPress={() => navigation.goBack()} style={[s.backBtn, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="arrow-left" size={16} color={text} />
          <Text style={[s.backBtnText, { color: text }]}>Volver</Text>
        </Pressable>
      </View>}

      {/* Main */}
      <ScrollView style={s.main} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Selector de período */}
        <View style={[s.periodCard, { backgroundColor: ComeYaColors.primary }]}>
          <Text style={s.periodLabel}>{periodLabels[selectedPeriod]}</Text>
          <Text style={s.periodAmount}>€{earnings[selectedPeriod].toFixed(2)}</Text>
          <View style={s.periodBtns}>
            {(["today", "week", "month"] as Period[]).map(p => (
              <Pressable
                key={p}
                onPress={() => setSelectedPeriod(p)}
                style={[s.periodBtn, { backgroundColor: selectedPeriod === p ? "#fff" : "rgba(255,255,255,0.2)" }]}
              >
                <Text style={[s.periodBtnText, { color: selectedPeriod === p ? ComeYaColors.primary : "#fff" }]}>
                  {periodLabels[p]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Historial de transacciones */}
        <Text style={[s.sectionTitle, { color: text }]}>Historial de transacciones</Text>
        {isLoading ? (
          <View style={s.loading}><ActivityIndicator color={ComeYaColors.primary} /></View>
        ) : transactions.length === 0 ? (
          <View style={[s.emptyCard, { backgroundColor: card, borderColor: border }]}>
            <Feather name="inbox" size={40} color={sub} />
            <Text style={[s.emptyText, { color: sub }]}>No hay transacciones aún</Text>
          </View>
        ) : (
          transactions.slice(0, 20).map((tx: any) => (
            <View key={tx.id} style={[s.txRow, { backgroundColor: card, borderColor: border }]}>
              <View style={[s.txIcon, { backgroundColor: getTransactionColor(tx.type) + "20" }]}>
                <Feather name="dollar-sign" size={18} color={getTransactionColor(tx.type)} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[s.txDesc, { color: text }]}>{tx.description}</Text>
                <Text style={[s.txDate, { color: sub }]}>{new Date(tx.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</Text>
              </View>
              <Text style={[s.txAmount, { color: tx.amount < 0 ? ComeYaColors.error : ComeYaColors.success }]}>
                {tx.amount < 0 ? "-" : "+"}€{(Math.abs(tx.amount) / 100).toFixed(2)}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* Modal retiro */}
      {showWithdrawModal && (
        <View style={s.modalOverlay}>
          <View style={[s.modal, { backgroundColor: card, borderColor: border }]}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: text }]}>Solicitar Retiro</Text>
              <Pressable onPress={() => setShowWithdrawModal(false)}>
                <Feather name="x" size={22} color={text} />
              </Pressable>
            </View>
            <Text style={[s.modalSub, { color: sub }]}>Disponible: €{wallet.canWithdraw.toFixed(2)}</Text>
            <TextInput
              style={[s.modalInput, { backgroundColor: inputBg, color: text, borderColor: border }]}
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
              placeholder="0.00"
              placeholderTextColor={sub}
              keyboardType="numeric"
            />
            <Text style={[s.modalNote, { color: sub }]}>Mínimo €50 · Procesado en 1-3 días hábiles</Text>
            <Pressable
              onPress={handleWithdraw}
              disabled={withdrawMutation.isPending}
              style={[s.modalBtn, { backgroundColor: ComeYaColors.primary, opacity: withdrawMutation.isPending ? 0.6 : 1 }]}
            >
              {withdrawMutation.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.modalBtnText}>Confirmar Retiro</Text>}
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "row" },
  sidebar: { width: 280, padding: 20, borderRightWidth: 1, paddingTop: 32 },
  walletCard: { padding: 20, borderRadius: 16, alignItems: "center", marginBottom: 16 },
  walletLabel: { color: "rgba(255,255,255,0.85)", fontSize: 13, marginBottom: 4 },
  walletAmount: { color: "#fff", fontSize: 36, fontWeight: "900", marginBottom: 12 },
  withdrawBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  withdrawBtnText: { fontSize: 13, fontWeight: "700" },
  quickStats: { flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 16, marginBottom: 16 },
  quickStat: { flex: 1, alignItems: "center", gap: 4 },
  quickStatValue: { fontSize: 18, fontWeight: "800" },
  quickStatLabel: { fontSize: 11 },
  totalEarned: { fontSize: 28, fontWeight: "900", textAlign: "center" },
  totalEarnedLabel: { fontSize: 12, textAlign: "center", marginBottom: 20 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, justifyContent: "center" },
  backBtnText: { fontSize: 14, fontWeight: "600" },
  main: { flex: 1 },
  content: { padding: 32, maxWidth: 720 },
  periodCard: { padding: 28, borderRadius: 20, alignItems: "center", marginBottom: 24 },
  periodLabel: { color: "rgba(255,255,255,0.8)", fontSize: 14, marginBottom: 4 },
  periodAmount: { color: "#fff", fontSize: 48, fontWeight: "900", marginBottom: 16 },
  periodBtns: { flexDirection: "row", gap: 8 },
  periodBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  periodBtnText: { fontSize: 13, fontWeight: "700" },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  loading: { paddingVertical: 40, alignItems: "center" },
  emptyCard: { padding: 40, borderRadius: 16, borderWidth: 1, alignItems: "center", gap: 12 },
  emptyText: { fontSize: 15 },
  txRow: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  txIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  txDesc: { fontSize: 14, fontWeight: "600" },
  txDate: { fontSize: 12, marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: "800" },
  modalOverlay: { position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" } as any,
  modal: { width: 400, padding: 32, borderRadius: 20, borderWidth: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: "800" },
  modalSub: { fontSize: 14, marginBottom: 16 },
  modalInput: { height: 56, borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 16, fontSize: 24, fontWeight: "700", marginBottom: 8 },
  modalNote: { fontSize: 12, marginBottom: 20 },
  modalBtn: { paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  modalBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
