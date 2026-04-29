import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";

interface Alert {
  id: string;
  icon: string;
  color: string;
  title: string;
  desc: string;
  action: string;
  onPress: () => void;
}

interface Props {
  metrics: any;
  finance: any;
  onNavigate: (section: string) => void;
}

export function AlertsPanel({ metrics, finance, onNavigate }: Props) {
  const { isDark } = useTheme();

  const bg     = isDark ? "#1a1a1a" : "#fff";
  const border = isDark ? "#2a2a2a" : "#f0f0f0";
  const text   = isDark ? "#fff"    : "#111";
  const sub    = isDark ? "#666"    : "#aaa";

  const alerts: Alert[] = [];

  const pendingProofs = metrics?.pendingPayments ?? 0;
  if (pendingProofs > 0) {
    alerts.push({
      id: "proofs",
      icon: "file-text",
      color: "#F97316",
      title: `${pendingProofs} comprobante${pendingProofs > 1 ? "s" : ""} sin verificar`,
      desc: "Requieren revisión manual antes de confirmar pedidos",
      action: "Verificar ahora",
      onPress: () => onNavigate("proofs"),
    });
  }

  const pendingPayouts = finance?.pendingPayouts ?? 0;
  if (pendingPayouts > 0) {
    const amt = finance?.pendingPayoutAmount ?? 0;
    const fmtAmt = amt >= 100_000 ? `€${(amt / 100 / 1_000).toFixed(1)}K` : `€${(amt / 100).toFixed(0)}`;
    alerts.push({
      id: "payouts",
      icon: "send",
      color: "#8B5CF6",
      title: `${pendingPayouts} payout${pendingPayouts > 1 ? "s" : ""} pendiente${pendingPayouts > 1 ? "s" : ""}`,
      desc: `${fmtAmt} por transferir a negocios y repartidores`,
      action: "Gestionar pagos",
      onPress: () => onNavigate("finance"),
    });
  }

  const openTickets = metrics?.openTickets ?? 0;
  if (openTickets > 0) {
    alerts.push({
      id: "support",
      icon: "message-circle",
      color: "#EF4444",
      title: `${openTickets} ticket${openTickets > 1 ? "s" : ""} de soporte abierto${openTickets > 1 ? "s" : ""}`,
      desc: "Usuarios esperando respuesta del equipo",
      action: "Ver tickets",
      onPress: () => onNavigate("support"),
    });
  }

  if (alerts.length === 0) {
    return (
      <View style={[ap.card, { backgroundColor: bg, borderColor: border }]}>
        <View style={ap.header}>
          <View style={[ap.iconWrap, { backgroundColor: "#10B98115" }]}>
            <Feather name="check-circle" size={15} color="#10B981" />
          </View>
          <Text style={[ap.title, { color: text }]}>Sin alertas pendientes</Text>
        </View>
        <Text style={[ap.empty, { color: sub }]}>Todo está al día ✓</Text>
      </View>
    );
  }

  return (
    <View style={[ap.card, { backgroundColor: bg, borderColor: border }]}>
      <View style={ap.header}>
        <View style={[ap.iconWrap, { backgroundColor: "#EF444415" }]}>
          <Feather name="bell" size={15} color="#EF4444" />
        </View>
        <Text style={[ap.title, { color: text }]}>Alertas accionables</Text>
        <View style={[ap.countBadge, { backgroundColor: "#EF4444" }]}>
          <Text style={ap.countTxt}>{alerts.length}</Text>
        </View>
      </View>

      {alerts.map((a, i) => (
        <View
          key={a.id}
          style={[
            ap.alertRow,
            { borderLeftColor: a.color, backgroundColor: a.color + "08" },
            i < alerts.length - 1 && { marginBottom: 8 },
          ]}
        >
          <View style={[ap.alertIcon, { backgroundColor: a.color + "20" }]}>
            <Feather name={a.icon as any} size={16} color={a.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[ap.alertTitle, { color: text }]}>{a.title}</Text>
            <Text style={[ap.alertDesc, { color: sub }]}>{a.desc}</Text>
          </View>
          <Pressable
            onPress={a.onPress}
            style={[ap.actionBtn, { backgroundColor: a.color + "18", borderColor: a.color + "40" }]}
          >
            <Text style={[ap.actionTxt, { color: a.color }]}>{a.action}</Text>
            <Feather name="arrow-right" size={11} color={a.color} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const ap = StyleSheet.create({
  card:       { borderRadius: 16, borderWidth: 1, padding: 20, marginBottom: 16 },
  header:     { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  iconWrap:   { width: 30, height: 30, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  title:      { flex: 1, fontSize: 14, fontWeight: "700" },
  countBadge: { width: 20, height: 20, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  countTxt:   { fontSize: 10, fontWeight: "800", color: "#fff" },
  alertRow:   { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 10, borderLeftWidth: 3 },
  alertIcon:  { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  alertTitle: { fontSize: 13, fontWeight: "700" },
  alertDesc:  { fontSize: 11, marginTop: 2 },
  actionBtn:  { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  actionTxt:  { fontSize: 11, fontWeight: "700" },
  empty:      { fontSize: 13, textAlign: "center", paddingVertical: 8 },
});
