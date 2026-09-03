import React, { useState } from "react";
import {
 View,
 Text,
 ScrollView,
 StyleSheet,
 Pressable,
 ActivityIndicator,
 Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { apiRequest } from "@/lib/query-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import {
 ComeYaColors,
 Spacing,
 BorderRadius,
 Shadows,
} from "@/constants/theme";

const PRIMARY = "#E60000";

type Tab = "upcoming" | "history";

const STATUS_CONFIG: Record<
 string,
 { label: string; color: string; icon: string }
> = {
 executed: { label: "Completado", color: "#10B981", icon: "check-circle" },
 cancelled: { label: "Cancelado", color: "#EF4444", icon: "x-circle" },
 failed: { label: "Fallido", color: "#F59E0B", icon: "alert-circle" },
};

const RECURRENCE_LABELS: Record<string, string> = {
 daily: "Diariamente",
 weekly: "Semanalmente",
 monthly: "Mensualmente",
};

export default function ScheduledOrdersScreen() {
 const insets = useSafeAreaInsets();
 const navigation = useNavigation();
 const { theme } = useTheme();
 const { user } = useAuth();
 const { showToast } = useToast();
 const queryClient = useQueryClient();
 const [activeTab, setActiveTab] = useState<Tab>("upcoming");

 const { data: scheduledOrders = [], isLoading } = useQuery({
 queryKey: ["scheduled-orders", user?.id],
 queryFn: async () => {
 const res = await apiRequest("GET", "/api/scheduled-orders");
 const d = await res.json();
 return d.success ? d.scheduledOrders : [];
 },
 enabled: !!user?.id,
 });

 const cancelMutation = useMutation({
 mutationFn: async (id: string) => {
 const res = await apiRequest("DELETE", `/api/scheduled-orders/${id}`);
 return res.json();
 },
 onSuccess: () => {
 showToast("Pedido cancelado", "success");
 queryClient.invalidateQueries({ queryKey: ["scheduled-orders"] });
 },
 onError: () => showToast("No se pudo cancelar el pedido", "error"),
 });

 const formatDateTime = (dateString: string) => {
 const date = new Date(dateString);
 return {
 date: date.toLocaleDateString("es-ES", {
 weekday: "long",
 day: "numeric",
 month: "long",
 year: "numeric",
 }),
 time: date.toLocaleTimeString("es-ES", {
 hour: "2-digit",
 minute: "2-digit",
 }),
 };
 };

 const formatCurrency = (amount: number) =>
   (amount / 100).toLocaleString("es-ES", {
     minimumFractionDigits: 2,
     maximumFractionDigits: 2,
   }) + " €";

 const upcomingOrders = (scheduledOrders as any[]).filter(
 (o) => o.status === "pending",
 );
 const historyOrders = (scheduledOrders as any[]).filter((o) =>
 ["executed", "cancelled", "failed"].includes(o.status),
 );
 const displayOrders =
 activeTab === "upcoming" ? upcomingOrders : historyOrders;

 const handleCancel = (id: string) => {
 Alert.alert("Cancelar pedido", ",%%Est%s seguro?", [
 { text: "No", style: "cancel" },
 {
 text: "S%, cancelar",
 style: "destructive",
 onPress: () => cancelMutation.mutate(id),
 },
 ]);
 };

 return (
 <View
 style={[
 styles.container,
 { backgroundColor: theme.backgroundRoot, paddingTop: insets.top },
 ]}
 >
 <View style={styles.header}>
 <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
 <Feather name="arrow-left" size={24} color={theme.text} />
 </Pressable>
 <Text style={[styles.title, { color: theme.text }]}>
 Pedidos Programados
 </Text>
 <View style={{ width: 44 }} />
 </View>

 {/* Tabs */}
 <View style={[styles.tabRow, { backgroundColor: theme.card }]}>
 {(
 [
 {
 id: "upcoming",
 label: `Pr%%ximos (${upcomingOrders.length})`,
 icon: "clock",
 },
 {
 id: "history",
 label: `Historial (${historyOrders.length})`,
 icon: "archive",
 },
 ] as { id: Tab; label: string; icon: string }[]
 ).map((tab) => (
 <Pressable
 key={tab.id}
 onPress={() => setActiveTab(tab.id)}
 style={[
 styles.tab,
 activeTab === tab.id && {
 borderBottomColor: PRIMARY,
 borderBottomWidth: 2,
 },
 ]}
 >
 <Feather
 name={tab.icon as any}
 size={15}
 color={activeTab === tab.id ? PRIMARY : theme.textSecondary}
 />
 <Text
 style={[
 styles.tabText,
 { color: activeTab === tab.id ? PRIMARY : theme.textSecondary },
 ]}
 >
 {tab.label}
 </Text>
 </Pressable>
 ))}
 </View>

 {isLoading ? (
 <View style={styles.loadingWrap}>
 <ActivityIndicator size="large" color={PRIMARY} />
 <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
 Cargando pedidos...
 </Text>
 </View>
  ) : displayOrders.length === 0 ? (
  <View style={styles.emptyWrap}>
  <Feather
  name={activeTab === "upcoming" ? "calendar" : "archive"}
  size={48}
  color={theme.textSecondary}
  />
  <Text style={[styles.emptyTitle, { color: theme.text }]}>
  {activeTab === "upcoming"
  ? "Sin pedidos programados"
  : "Sin historial"}
  </Text>
  {activeTab === "upcoming" && (
  <>
   <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
    Programa tus pedidos favoritos para que lleguen cuando los
    necesites
   </Text>
    <Pressable
     onPress={() => (navigation as any).navigate("BusinessList")}
     style={[
      styles.ctaButton,
      { backgroundColor: ComeYaColors.primary },
      Shadows.md,
     ]}
    >
     <Feather name="plus-circle" size={20} color="#fff" />
     <Text style={styles.ctaButtonText}>
      Crear Pedido Programado
     </Text>
    </Pressable>
  </>
  )}
  </View>
 ) : (
 <ScrollView
 contentContainerStyle={styles.content}
 showsVerticalScrollIndicator={false}
 >
 {activeTab === "upcoming"
 ? upcomingOrders.map((order: any) => {
 const { date, time } = formatDateTime(order.scheduledFor);
 const items = (() => {
 try {
 return JSON.parse(order.items);
 } catch {
 return [];
 }
 })();
 return (
 <View
 key={order.id}
 style={[
 styles.orderCard,
 { backgroundColor: theme.card },
 Shadows.sm,
 ]}
 >
 <View style={styles.orderHeader}>
 <View
 style={[
 styles.orderIcon,
 { backgroundColor: PRIMARY + "15" },
 ]}
 >
 <Feather
 name="shopping-bag"
 size={20}
 color={PRIMARY}
 />
 </View>
 <View style={{ flex: 1, marginLeft: 12 }}>
 <Text
 style={[styles.businessName, { color: theme.text }]}
 >
 {order.businessName || "Negocio"}
 </Text>
 {order.recurringPattern && (
 <View style={styles.recurringBadge}>
 <Feather name="repeat" size={11} color={PRIMARY} />
 <Text
 style={[styles.recurringText, { color: PRIMARY }]}
 >
 {RECURRENCE_LABELS[order.recurringPattern] ||
 order.recurringPattern}
 </Text>
 </View>
 )}
 </View>
 <Text style={[styles.totalText, { color: PRIMARY }]}>
 {formatCurrency(order.total || 0)}
 </Text>
 </View>

 <View
 style={[
 styles.dateSection,
 { borderTopColor: theme.border },
 ]}
 >
 <View style={styles.dateRow}>
 <Feather
 name="calendar"
 size={14}
 color={theme.textSecondary}
 />
 <Text
 style={[
 styles.dateText,
 { color: theme.textSecondary },
 ]}
 >
 {date}
 </Text>
 </View>
 <View style={styles.dateRow}>
 <Feather
 name="clock"
 size={14}
 color={theme.textSecondary}
 />
 <Text
 style={[
 styles.dateText,
 { color: theme.textSecondary },
 ]}
 >
 {time}
 </Text>
 </View>
 </View>

 {items.length > 0 && (
 <View
 style={[
 styles.itemsSection,
 { borderTopColor: theme.border },
 ]}
 >
 {items.slice(0, 3).map((item: any, idx: number) => (
 <Text
 key={idx}
 style={[
 styles.itemText,
 { color: theme.textSecondary },
 ]}
 >
 ,% {item.quantity}x {item.product?.name || item.name}
 </Text>
 ))}
 {items.length > 3 && (
 <Text
 style={[
 styles.moreItems,
 { color: theme.textSecondary },
 ]}
 >
 +{items.length - 3} productos m%s
 </Text>
 )}
 </View>
 )}

 <View
 style={[
 styles.orderFooter,
 { borderTopColor: theme.border },
 ]}
 >
 <Pressable
 onPress={() => handleCancel(order.id)}
 disabled={cancelMutation.isPending}
 style={[styles.cancelBtn, { borderColor: "#EF4444" }]}
 >
 {cancelMutation.isPending ? (
 <ActivityIndicator size="small" color="#EF4444" />
 ) : (
 <>
 <Feather name="trash-2" size={14} color="#EF4444" />
 <Text style={styles.cancelBtnText}>
 Cancelar pedido
 </Text>
 </>
 )}
 </Pressable>
 </View>
 </View>
 );
 })
 : historyOrders.map((order: any) => {
 const { date, time } = formatDateTime(order.scheduledFor);
 const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.failed;
 return (
 <View
 key={order.id}
 style={[
 styles.historyCard,
 { backgroundColor: theme.card },
 Shadows.sm,
 ]}
 >
 <View
 style={[
 styles.historyIcon,
 { backgroundColor: cfg.color + "15" },
 ]}
 >
 <Feather
 name={cfg.icon as any}
 size={20}
 color={cfg.color}
 />
 </View>
 <View style={{ flex: 1, marginLeft: 12 }}>
 <Text
 style={[styles.businessName, { color: theme.text }]}
 >
 {order.businessName || "Negocio"}
 </Text>
 <Text
 style={[
 styles.dateText,
 { color: theme.textSecondary },
 ]}
 >
 {date} ,% {time}
 </Text>
 </View>
 <View
 style={[
 styles.statusPill,
 { backgroundColor: cfg.color + "15" },
 ]}
 >
 <Text style={[styles.statusText, { color: cfg.color }]}>
 {cfg.label}
 </Text>
 </View>
 </View>
 );
 })}
 </ScrollView>
 )}
 </View>
 );
}

const styles = StyleSheet.create({
 container: { flex: 1 },
 header: {
 flexDirection: "row",
 alignItems: "center",
 justifyContent: "space-between",
 paddingHorizontal: Spacing.lg,
 paddingBottom: Spacing.md,
 },
 backBtn: { width: 44, height: 44, justifyContent: "center" },
 title: { fontSize: 20, fontWeight: "700" },
 tabRow: {
 flexDirection: "row",
 borderBottomWidth: 1,
 borderBottomColor: "rgba(0,0,0,0.08)",
 },
 tab: {
 flex: 1,
 flexDirection: "row",
 alignItems: "center",
 justifyContent: "center",
 gap: 6,
 paddingVertical: 14,
 borderBottomWidth: 2,
 borderBottomColor: "transparent",
 },
 tabText: { fontSize: 13, fontWeight: "600" },
 loadingWrap: {
 flex: 1,
 justifyContent: "center",
 alignItems: "center",
 gap: 12,
 },
 loadingText: { fontSize: 14 },
 emptyWrap: {
 flex: 1,
 justifyContent: "center",
 alignItems: "center",
 padding: Spacing.xl,
 gap: 12,
 },
 emptyTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
 emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
 content: { padding: Spacing.lg, paddingBottom: 80 },
 orderCard: {
 borderRadius: BorderRadius.xl,
 marginBottom: Spacing.md,
 overflow: "hidden",
 },
 orderHeader: {
 flexDirection: "row",
 alignItems: "center",
 padding: Spacing.lg,
 },
 orderIcon: {
 width: 44,
 height: 44,
 borderRadius: 22,
 justifyContent: "center",
 alignItems: "center",
 },
 businessName: { fontSize: 15, fontWeight: "700", marginBottom: 3 },
 recurringBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
 recurringText: { fontSize: 11, fontWeight: "600" },
 totalText: { fontSize: 18, fontWeight: "800" },
 dateSection: {
 flexDirection: "row",
 gap: 20,
 paddingHorizontal: Spacing.lg,
 paddingVertical: Spacing.md,
 borderTopWidth: 1,
 },
 dateRow: { flexDirection: "row", alignItems: "center", gap: 6 },
 dateText: { fontSize: 13 },
 itemsSection: {
 paddingHorizontal: Spacing.lg,
 paddingVertical: Spacing.md,
 borderTopWidth: 1,
 gap: 4,
 },
 itemText: { fontSize: 13 },
 moreItems: { fontSize: 12, fontStyle: "italic" },
 orderFooter: {
 flexDirection: "row",
 justifyContent: "flex-end",
 padding: Spacing.md,
 borderTopWidth: 1,
 },
 cancelBtn: {
 flexDirection: "row",
 alignItems: "center",
 gap: 6,
 borderWidth: 1,
 borderRadius: 8,
 paddingHorizontal: 14,
 paddingVertical: 8,
 },
 cancelBtnText: { color: "#EF4444", fontSize: 13, fontWeight: "600" },
 historyCard: {
 flexDirection: "row",
 alignItems: "center",
 borderRadius: BorderRadius.lg,
 padding: Spacing.lg,
 marginBottom: Spacing.md,
 },
 historyIcon: {
 width: 44,
 height: 44,
 borderRadius: 22,
 justifyContent: "center",
 alignItems: "center",
 },
 statusPill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
 statusText: { fontSize: 12, fontWeight: "700" },
 ctaButton: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  paddingVertical: Spacing.md,
  paddingHorizontal: Spacing.lg,
  borderRadius: BorderRadius.lg,
  marginTop: Spacing.lg,
 },
 ctaButtonText: {
  color: "#fff",
  fontSize: 15,
  fontWeight: "700",
 },
});
