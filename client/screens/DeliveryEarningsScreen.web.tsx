import React, { useState } from "react";
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { apiRequest } from "@/lib/query-client";
import { MobileSidebarWrapper } from "@/components/MobileSidebarWrapper";

const PRIMARY = "#DC2626";
type Period = "today" | "week" | "month";

const TX_ICON: Record<string, string> = {
  income: "dollar-sign",
  delivery_income: "dollar-sign",
  cash_collected: "briefcase",
  cash_debt: "alert-circle",
  withdrawal: "arrow-up-circle",
  tip: "gift",
};
const TX_COLOR: Record<string, string> = {
  income: "#10B981",
  delivery_income: "#10B981",
  cash_collected: "#2196F3",
  cash_debt: "#EF4444",
  withdrawal: "#F59E0B",
  tip: "#9C27B0",
};

export default function DeliveryEarningsScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>("week");
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const cardBg = isDark ? "#2a2a2a" : "#f9fafb";

  const { data: statsData, refetch: refetchStats } = useQuery<any>({
    queryKey: ["/api/delivery/stats"],
    enabled: !!user?.id,
  });
  const { data: walletData, refetch: refetchWallet } = useQuery<any>({
    queryKey: ["/api/wallet/balance"],
    enabled: !!user?.id,
  });
  const { data: txData, refetch: refetchTx } = useQuery<any>({
    queryKey: ["/api/wallet/transactions"],
    enabled: !!user?.id,
  });

  const withdrawMutation = useMutation({
    mutationFn: async (amount: number) =>
      (
        await apiRequest("POST", "/api/wallet/withdraw", {
          amount: Math.round(amount * 100),
        })
      ).json(),
    onSuccess: (d) => {
      if (d.success) {
        showToast(
          "Solicitud de retiro enviada. Recibirás el pago en 1-3 días hábiles.",
          "success",
        );
        setShowWithdraw(false);
        setWithdrawAmount("");
        queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
        queryClient.invalidateQueries({
          queryKey: ["/api/wallet/transactions"],
        });
      } else showToast(d.error || "Error al procesar el retiro", "error");
    },
  });

  const handleWithdraw = () => {
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast("Ingresa un monto válido", "error");
      return;
    }
    if (amt > canWithdraw) {
      showToast("No tienes suficiente saldo disponible", "error");
      return;
    }
    if (amt < 50) {
      showToast("El monto mínimo de retiro es €50", "error");
      return;
    }
    withdrawMutation.mutate(amt);
  };

  const wallet = walletData?.wallet;
  const balance = (wallet?.balance || 0) / 100;
  const cashOwed = (wallet?.cashOwed || 0) / 100;
  const canWithdraw =
    Math.max(0, (wallet?.balance || 0) - (wallet?.cashOwed || 0)) / 100;
  const totalEarned = (wallet?.totalEarned || 0) / 100;

  const stats = statsData?.stats || {};
  const earnings = {
    today: (stats.todayEarnings || 0) / 100,
    week: (stats.weekEarnings || 0) / 100,
    month: (stats.monthEarnings || 0) / 100,
  };
  const periodEarnings = earnings[period];

  const transactions: any[] = txData?.transactions || [];
  const PERIOD_LABELS: Record<Period, string> = {
    today: "Hoy",
    week: "Esta semana",
    month: "Este mes",
  };

  const STAT_CARDS = [
    {
      icon: "truck",
      label: "Entregas totales",
      value: stats.totalDeliveries || 0,
      color: "#4CAF50",
    },
    {
      icon: "star",
      label: "Calificación",
      value: (stats.rating || 0).toFixed(1),
      color: "#FF9800",
    },
    {
      icon: "check-circle",
      label: "Completadas",
      value: `${stats.completionRate || 100}%`,
      color: "#2196F3",
    },
    {
      icon: "clock",
      label: "Tiempo prom.",
      value: `${stats.avgDeliveryTime || 0}m`,
      color: "#9C27B0",
    },
  ];

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <MobileSidebarWrapper
        title="Mi Wallet"
        sidebarStyle={[
          s.sidebar,
          { backgroundColor: card, borderRightColor: border },
        ]}
      >
        <View style={[s.sideHeader, { borderBottomColor: border }]}>
          <View
            style={[
              s.sideIconWrap,
              { backgroundColor: cashOwed > 0 ? "#EF444415" : "#10B98115" },
            ]}
          >
            <Feather
              name={cashOwed > 0 ? "alert-circle" : "dollar-sign"}
              size={32}
              color={cashOwed > 0 ? "#EF4444" : "#10B981"}
            />
          </View>
          <Text style={[s.sideTitle, { color: text }]}>Mi Wallet</Text>
          <Text style={[s.sideSub, { color: sub }]}>Repartidor ComeYa</Text>
          <View
            style={[
              s.walletBadge,
              {
                backgroundColor: cashOwed > 0 ? "#EF444415" : "#10B98115",
                borderColor: cashOwed > 0 ? "#EF444430" : "#10B98130",
              },
            ]}
          >
            <Text
              style={{
                color: cashOwed > 0 ? "#EF4444" : "#10B981",
                fontSize: 13,
                fontWeight: "700",
              }}
            >
              {cashOwed > 0
                ? `Debes ${cashOwed.toFixed(2)} €`
                : `${canWithdraw.toFixed(2)} € disponible`}
            </Text>
          </View>
        </View>
        <View style={s.sideStats}>
          <View style={[s.statBox, { backgroundColor: cardBg }]}>
            <Text style={[s.statNum, { color: text }]}>
              {totalEarned.toFixed(0)} €
            </Text>
            <Text style={[s.statLabel, { color: sub }]}>Total ganado</Text>
          </View>
          <View style={[s.statBox, { backgroundColor: cardBg }]}>
            <Text style={[s.statNum, { color: text }]}>
              {transactions.length}
            </Text>
            <Text style={[s.statLabel, { color: sub }]}>Transacciones</Text>
          </View>
        </View>
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
        {/* Wallet hero */}
        <View
          style={[
            s.walletCard,
            { backgroundColor: cashOwed > 0 ? "#EF4444" : "#10B981" },
          ]}
        >
          <Text style={s.walletLabel}>
            {cashOwed > 0 ? "🚨 Debes Depositar" : "✅ Disponible para Retirar"}
          </Text>
          <Text style={s.walletAmount}>
            {cashOwed > 0 ? cashOwed.toFixed(2) : canWithdraw.toFixed(2)} €
          </Text>
          {cashOwed > 0 && (
            <View style={s.deadlineRow}>
              <Feather name="clock" size={14} color="rgba(255,255,255,0.9)" />
              <Text style={s.deadlineText}>Fecha límite: Domingo 11:59 PM</Text>
            </View>
          )}
          <View style={s.breakdownGrid}>
            <View style={s.breakdownItem}>
              <Text style={s.breakdownLabel}>Balance digital</Text>
              <Text style={s.breakdownValue}>{balance.toFixed(2)} €</Text>
            </View>
            <View style={s.breakdownItem}>
              <Text style={s.breakdownLabel}>Deuda efectivo</Text>
              <Text style={s.breakdownValue}>-{cashOwed.toFixed(2)} €</Text>
            </View>
            <View style={s.breakdownItem}>
              <Text style={s.breakdownLabel}>Disponible</Text>
              <Text style={s.breakdownValue}>{canWithdraw.toFixed(2)} €</Text>
            </View>
            <View style={s.breakdownItem}>
              <Text style={s.breakdownLabel}>Total ganado</Text>
              <Text style={s.breakdownValue}>{totalEarned.toFixed(2)} €</Text>
            </View>
          </View>
          {canWithdraw > 0 && (
            <Pressable
              onPress={() => setShowWithdraw(true)}
              style={s.withdrawBtn}
            >
              <Feather
                name="arrow-up-circle"
                size={18}
                color={cashOwed > 0 ? "#EF4444" : "#10B981"}
              />
              <Text
                style={[
                  s.withdrawBtnText,
                  { color: cashOwed > 0 ? "#EF4444" : "#10B981" },
                ]}
              >
                Solicitar Retiro
              </Text>
            </Pressable>
          )}
        </View>

        {/* Modal retiro inline */}
        {showWithdraw && (
          <View
            style={[
              s.withdrawCard,
              { backgroundColor: card, borderColor: border },
            ]}
          >
            <View style={s.withdrawHeader}>
              <Text style={[s.withdrawTitle, { color: text }]}>
                Solicitar Retiro
              </Text>
              <Pressable onPress={() => setShowWithdraw(false)}>
                <Feather name="x" size={20} color={sub} />
              </Pressable>
            </View>
            <Text style={[s.withdrawSub, { color: sub }]}>
              Disponible: {canWithdraw.toFixed(2)} € · Mínimo €50
            </Text>
            <TextInput
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
              placeholder="0.00"
              placeholderTextColor={sub}
              keyboardType="numeric"
              style={[
                s.withdrawInput,
                { backgroundColor: cardBg, color: text, borderColor: border },
              ]}
            />
            <Pressable
              onPress={handleWithdraw}
              disabled={withdrawMutation.isPending}
              style={[
                s.withdrawConfirmBtn,
                {
                  backgroundColor: PRIMARY,
                  opacity: withdrawMutation.isPending ? 0.6 : 1,
                },
              ]}
            >
              {withdrawMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.withdrawConfirmText}>Confirmar Retiro</Text>
              )}
            </Pressable>
          </View>
        )}

        {/* Ganancias por período */}
        <View style={[s.earningsCard, { backgroundColor: PRIMARY }]}>
          <Text style={s.earningsLabel}>{PERIOD_LABELS[period]}</Text>
          <Text style={s.earningsAmount}>{periodEarnings.toFixed(2)} €</Text>
          <View style={s.periodRow}>
            {(["today", "week", "month"] as Period[]).map((p) => (
              <Pressable
                key={p}
                onPress={() => setPeriod(p)}
                style={[
                  s.periodBtn,
                  {
                    backgroundColor:
                      period === p ? "#fff" : "rgba(255,255,255,0.2)",
                  },
                ]}
              >
                <Text
                  style={[
                    s.periodBtnText,
                    { color: period === p ? PRIMARY : "#fff" },
                  ]}
                >
                  {PERIOD_LABELS[p]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Stats */}
        <View style={s.statsGrid}>
          {STAT_CARDS.map((sc) => (
            <View
              key={sc.label}
              style={[
                s.statCard,
                { backgroundColor: card, borderColor: border },
              ]}
            >
              <View style={[s.statIcon, { backgroundColor: sc.color + "20" }]}>
                <Feather name={sc.icon as any} size={20} color={sc.color} />
              </View>
              <Text style={[s.statValue, { color: text }]}>{sc.value}</Text>
              <Text style={[s.statLabel2, { color: sub }]}>{sc.label}</Text>
            </View>
          ))}
        </View>

        {/* Transacciones */}
        <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
          <View style={s.cardHeader}>
            <Feather name="list" size={18} color={PRIMARY} />
            <Text style={[s.cardTitle, { color: text }]}>
              Historial de Transacciones
            </Text>
          </View>
          {transactions.length === 0 ? (
            <View style={s.emptyTx}>
              <Feather name="inbox" size={36} color={sub} />
              <Text style={[s.emptyTxText, { color: sub }]}>
                No hay transacciones aún
              </Text>
            </View>
          ) : (
            transactions.slice(0, 15).map((tx: any) => {
              const color = TX_COLOR[tx.type] || sub;
              const icon = TX_ICON[tx.type] || "activity";
              return (
                <View
                  key={tx.id}
                  style={[s.txRow, { borderBottomColor: border }]}
                >
                  <View style={[s.txIcon, { backgroundColor: color + "20" }]}>
                    <Feather name={icon as any} size={16} color={color} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[s.txDesc, { color: text }]}>
                      {tx.description}
                    </Text>
                    <Text style={[s.txDate, { color: sub }]}>
                      {new Date(tx.createdAt).toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                  <Text
                    style={[
                      s.txAmount,
                      { color: tx.amount < 0 ? "#EF4444" : "#10B981" },
                    ]}
                  >
                    {tx.amount < 0 ? "-" : "+"}€
                    {(Math.abs(tx.amount) / 100).toFixed(2)}
                  </Text>
                </View>
              );
            })
          )}
        </View>
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
    marginBottom: 4,
    textAlign: "center",
  },
  sideSub: { fontSize: 12, textAlign: "center", marginBottom: 10 },
  walletBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  sideStats: { flexDirection: "row", gap: 10, padding: 16 },
  statBox: { flex: 1, borderRadius: 10, padding: 12, alignItems: "center" },
  statNum: { fontSize: 18, fontWeight: "800" },
  statLabel: { fontSize: 11, marginTop: 2 },
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
  content: { padding: 32, maxWidth: 800, paddingBottom: 80 },
  walletCard: {
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    marginBottom: 20,
  },
  walletLabel: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    marginBottom: 8,
  },
  walletAmount: {
    color: "#fff",
    fontSize: 52,
    fontWeight: "900",
    marginBottom: 12,
  },
  deadlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 16,
  },
  deadlineText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    fontWeight: "600",
  },
  breakdownGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    width: "100%",
    marginBottom: 16,
  },
  breakdownItem: {
    flex: 1,
    minWidth: 120,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  breakdownLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
    marginBottom: 4,
  },
  breakdownValue: { color: "#fff", fontSize: 16, fontWeight: "700" },
  withdrawBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  withdrawBtnText: { fontSize: 14, fontWeight: "700" },
  withdrawCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
  },
  withdrawHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  withdrawTitle: { fontSize: 16, fontWeight: "700" },
  withdrawSub: { fontSize: 13, marginBottom: 12 },
  withdrawInput: {
    height: 52,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 12,
  },
  withdrawConfirmBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  withdrawConfirmText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  earningsCard: {
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    marginBottom: 20,
  },
  earningsLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    marginBottom: 8,
  },
  earningsAmount: {
    color: "#fff",
    fontSize: 48,
    fontWeight: "900",
    marginBottom: 16,
  },
  periodRow: { flexDirection: "row", gap: 10 },
  periodBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  periodBtnText: { fontSize: 13, fontWeight: "700" },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: 160,
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
    alignItems: "center",
    gap: 8,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  statValue: { fontSize: 22, fontWeight: "800" },
  statLabel2: { fontSize: 13, textAlign: "center" },
  card: { borderRadius: 14, borderWidth: 1, padding: 20, marginBottom: 16 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  emptyTx: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyTxText: { fontSize: 14 },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  txIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  txDesc: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  txDate: { fontSize: 12 },
  txAmount: { fontSize: 15, fontWeight: "700" },
});
