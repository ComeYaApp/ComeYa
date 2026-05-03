import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, Text, ScrollView } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { ComeYaColors, Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useToast } from "@/contexts/ToastContext";

export default function OrderConfirmationScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute() as any;
  const { theme, isDark } = useTheme();
const { showToast } = useToast();

const PRIMARY = "#DC2626";

export default function OrderConfirmationScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute() as any;
  const { theme, isDark } = useTheme();
  const { showToast } = useToast();

  const { orderId, regretPeriodEndsAt } = route.params || {};
  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";

  const [secondsRemaining, setSecondsRemaining] = useState(60);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const isConfirmedRef = useRef(false);

  useEffect(() => {
    if (!orderId) navigation.navigate("Main");
  }, [orderId]);

  useEffect(() => {
    const endTime = new Date(regretPeriodEndsAt).getTime();
    const update = () => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining <= 0 && !isConfirmedRef.current) confirmOrder();
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [regretPeriodEndsAt]);

  const confirmOrder = useCallback(async () => {
    if (isConfirmedRef.current) return;
    isConfirmedRef.current = true;
    setIsConfirmed(true);
    try {
      await apiRequest("POST", `/api/orders/${orderId}/confirm`);
      showToast("Pedido confirmado y enviado al restaurante", "success");
      setTimeout(() => {
        navigation.reset({ index: 0, routes: [{ name: "Main" }, { name: "OrderTracking", params: { orderId } }] });
      }, 1500);
    } catch {
      isConfirmedRef.current = false;
      setIsConfirmed(false);
    }
  }, [orderId]);

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      await apiRequest("POST", `/api/orders/${orderId}/cancel-regret`);
      showToast("Pedido cancelado sin penalización", "success");
      navigation.reset({ index: 0, routes: [{ name: "Main" }] });
    } catch {
      showToast("No se pudo cancelar el pedido", "error");
      setIsCancelling(false);
    }
  };

  const progress = (secondsRemaining / 60) * 100;

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
          {/* Header */}
          <View style={[s.header, { borderBottomColor: border }]}>
            <Text style={[s.headerTitle, { color: text }]}>Confirma tu pedido</Text>
            <Text style={[s.headerSubtitle, { color: sub }]}>
              Revisa los detalles y completa tu compra de forma segura
            </Text>
          </View>

          {/* Tu pedido */}
          <View style={[s.section, { borderBottomColor: border }]}>
            <View style={s.sectionHeader}>
              <Text style={[s.sectionTitle, { color: text }]}>Tu pedido</Text>
              <Pressable onPress={() => navigation.navigate('OrderTracking', { orderId })}>
                <Feather name="arrow-right" size={18} color={sub} />
              </Pressable>
            </View>
            <Text style={[s.businessName, { color: PRIMARY }]}>Mercado Central</Text>
            <View style={s.itemRow}>
              <Text style={[s.itemName, { color: text }]}>1x Aguacate</Text>
              <Text style={[s.itemPrice, { color: text }]}>€2.07</Text>
            </View>
          </View>

          {/* Total */}
          <View style={[s.section, { borderBottomColor: border }]}>
            <View style={s.rowBetween}>
              <Text style={[s.label, { color: sub }]}>Subtotal</Text>
              <Text style={[s.value, { color: text }]}>€2.07</Text>
            </View>
            <View style={s.rowBetween}>
              <Text style={[s.label, { color: sub }]}>Envío (~22 min)</Text>
              <Text style={[s.value, { color: text }]}>€2.50</Text>
            </View>
            <View style={[s.totalRow, { borderTopColor: border }]}>
              <Text style={[s.totalLabel, { color: text }]}>Total</Text>
              <Text style={[s.totalValue, { color: PRIMARY }]}>€4.57</Text>
            </View>
          </View>

          {!isConfirmed && (
            <View style={s.actionSection}>
              <Text style={[s.actionLabel, { color: sub }]}>
                Tienes {secondsRemaining} segundos para cancelar sin penalización
              </Text>
              
              <View style={[s.timerBox, { backgroundColor: isDark ? '#2a2a2a' : '#f9f9f9', borderColor: border }]}>
                <Text style={[s.timerValue, { color: PRIMARY }]}>{secondsRemaining}</Text>
                <Text style={[s.timerLabel, { color: sub }]}>segundos</Text>
                <View style={[s.progressBarBg, { backgroundColor: isDark ? '#333' : '#e0e0e0' }]}>
                  <View style={[s.progressBarFill, { width: `${progress}%`, backgroundColor: PRIMARY }]} />
                </View>
              </View>

              <Pressable 
                onPress={() => confirmOrder()} 
                style={[s.confirmBtn, { backgroundColor: PRIMARY }]}
              >
                <Text style={s.confirmBtnText}>Confirmar pedido</Text>
              </Pressable>

              <Pressable 
                onPress={handleCancel} 
                disabled={isCancelling}
                style={[s.cancelBtn, { borderColor: '#EF4444' }]}
              >
                {isCancelling
                  ? <ActivityIndicator color="#EF4444" size="small" />
                  : <Text style={[s.cancelBtnText, { color: '#EF4444' }]}>Cancelar pedido</Text>
                }
              </Pressable>
            </View>
          )}

          {isConfirmed && (
            <View style={s.confirmedBox}>
              <Feather name="check-circle" size={48} color="#10B981" />
              <Text style={[s.confirmedText, { color: text }]}>Pedido confirmado</Text>
              <Text style={[s.confirmedSubtext, { color: sub }]}>Notificando al restaurante...</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: bg, justifyContent: "center", alignItems: "center" },
  content: { padding: 24, justifyContent: "center", alignItems: "center", maxWidth: 480, width: "100%" },
  card: { width: "100%", padding: 0, borderRadius: 16, borderWidth: 1, backgroundColor: card },
  header: { padding: 20, borderBottomWidth: 1 },
  headerTitle: { fontSize: 20, fontWeight: "800", marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: sub },
  section: { padding: 20, borderBottomWidth: 1 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: text },
  businessName: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  itemRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  itemName: { fontSize: 14, color: text },
  itemPrice: { fontSize: 14, fontWeight: "600" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  label: { fontSize: 14 },
  value: { fontSize: 14, fontWeight: "600" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 12, marginTop: 8, borderTopWidth: 1 },
  totalLabel: { fontSize: 16, fontWeight: "700" },
  totalValue: { fontSize: 18, fontWeight: "800" },
  actionSection: { padding: 20 },
  actionLabel: { fontSize: 14, textAlign: "center", marginBottom: 16 },
  timerBox: { padding: 16, borderRadius: 12, borderWidth: 1, alignItems: "center", marginBottom: 20 },
  timerValue: { fontSize: 36, fontWeight: "900" },
  timerLabel: { fontSize: 12, color: sub, marginBottom: 8 },
  progressBarBg: { width: "100%", height: 6, borderRadius: 3, overflow: "hidden" },
  progressBarFill: { height: "100%", borderRadius: 3 },
  confirmBtn: { paddingVertical: 16, borderRadius: 12, alignItems: "center", marginBottom: 12 },
  confirmBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  cancelBtn: { paddingVertical: 14, borderRadius: 12, borderWidth: 2, alignItems: "center" },
  cancelBtnText: { fontSize: 14, fontWeight: "700" },
  confirmedBox: { padding: 32, alignItems: "center" },
  confirmedText: { fontSize: 18, fontWeight: "700", marginTop: 12 },
  confirmedSubtext: { fontSize: 14, color: sub, marginTop: 4 },
});
