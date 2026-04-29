import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, Text } from "react-native";
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
      <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
        {/* Icono animado */}
        <View style={[s.iconCircle, { backgroundColor: ComeYaColors.primary + "15" }]}>
          <Feather name="check" size={48} color={ComeYaColors.primary} />
        </View>

        <Text style={[s.title, { color: text }]}>
          {isConfirmed ? "Pedido Confirmado" : "Pedido Recibido"}
        </Text>

        {!isConfirmed ? (
          <>
            <Text style={[s.subtitle, { color: sub }]}>
              Tienes {secondsRemaining} segundos para cancelar sin penalización
            </Text>

            <View style={[s.timerCard, { backgroundColor: isDark ? "#2a2a2a" : "#f9f9f9", borderColor: border }]}>
              <View style={s.timerHeader}>
                <Feather name="clock" size={18} color={ComeYaColors.primary} />
                <Text style={[s.timerLabel, { color: text }]}>Tiempo de arrepentimiento</Text>
              </View>
              <Text style={[s.timerNumber, { color: ComeYaColors.primary }]}>{secondsRemaining}</Text>
              <Text style={[s.timerSub, { color: sub }]}>segundos</Text>

              {/* Progress bar */}
              <View style={[s.progressBar, { backgroundColor: isDark ? "#333" : "#e0e0e0" }]}>
                <View style={[s.progressFill, { width: `${progress}%` as any, backgroundColor: ComeYaColors.primary }]} />
              </View>

              <Text style={[s.timerNote, { color: sub }]}>
                El restaurante aún no ha sido notificado. Puedes cancelar sin costo.
              </Text>
            </View>

            <Pressable
              onPress={handleCancel}
              disabled={isCancelling}
              style={[s.cancelBtn, { borderColor: ComeYaColors.error, backgroundColor: ComeYaColors.error + "10" }]}
            >
              {isCancelling
                ? <ActivityIndicator color={ComeYaColors.error} size="small" />
                : <>
                    <Feather name="x" size={18} color={ComeYaColors.error} />
                    <Text style={[s.cancelBtnText, { color: ComeYaColors.error }]}>Cancelar ahora</Text>
                  </>
              }
            </Pressable>

            <Pressable onPress={() => confirmOrder()} style={s.skipLink}>
              <Text style={{ color: ComeYaColors.primary, fontSize: 14 }}>Saltar y confirmar pedido</Text>
              <Feather name="arrow-right" size={14} color={ComeYaColors.primary} />
            </Pressable>
          </>
        ) : (
          <View style={s.confirmedState}>
            <ActivityIndicator color={ComeYaColors.primary} size="large" />
            <Text style={[s.subtitle, { color: sub, marginTop: 16 }]}>Notificando al restaurante...</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: { width: 480, padding: 48, borderRadius: 24, borderWidth: 1, alignItems: "center" },
  iconCircle: { width: 100, height: 100, borderRadius: 50, justifyContent: "center", alignItems: "center", marginBottom: 24 },
  title: { fontSize: 28, fontWeight: "800", marginBottom: 8, textAlign: "center" },
  subtitle: { fontSize: 15, textAlign: "center", marginBottom: 24, lineHeight: 22 },
  timerCard: { width: "100%", padding: 24, borderRadius: 16, borderWidth: 1, alignItems: "center", marginBottom: 24 },
  timerHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  timerLabel: { fontSize: 15, fontWeight: "600" },
  timerNumber: { fontSize: 72, fontWeight: "900", lineHeight: 80 },
  timerSub: { fontSize: 14, marginBottom: 16 },
  progressBar: { width: "100%", height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 12 },
  progressFill: { height: "100%", borderRadius: 4 },
  timerNote: { fontSize: 13, textAlign: "center", lineHeight: 18 },
  cancelBtn: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 2, marginBottom: 12 },
  cancelBtnText: { fontSize: 15, fontWeight: "700" },
  skipLink: { flexDirection: "row", alignItems: "center", gap: 6, padding: 8 },
  confirmedState: { alignItems: "center", paddingVertical: 24 },
});
