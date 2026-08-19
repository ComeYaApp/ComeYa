import React, { useState, useCallback } from "react";
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  Pressable,
  View,
  Text,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/query-client";
import { formatCurrency } from "@/utils/currency";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { ComeYaColors, Spacing, BorderRadius, Shadows } from "@/constants/theme";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PAYMENT_METHODS = [
  {
    id: "stripe_card",
    icon: "credit-card",
    color: "#635BFF",
    label: "Tarjeta (Stripe)",
    sub: "Visa, Mastercard — pago instantáneo",
    instant: true,
  },
  {
    id: "bizum_manual",
    icon: "smartphone",
    color: "#00ADEF",
    label: "Bizum",
    sub: "Transferencia Bizum + subir comprobante",
    instant: false,
  },
  {
    id: "paypal_manual",
    icon: "dollar-sign",
    color: "#1A56DB",
    label: "PayPal",
    sub: "Pago por PayPal + subir comprobante",
    instant: false,
  },
];

/** Formatea una fecha en español de forma legible */
function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  try {
    return new Date(date).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

/** Convierte centavos → euros como string  */
function centsToDisplay(cents: number | null | undefined): string {
  if (!cents && cents !== 0) return "—";
  return (cents / 100).toFixed(2);
}

export default function SubscriptionScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigation = useNavigation<Nav>();

  const isBusinessOwner = user?.role === "business_owner";

  const customerBenefits = [
    "Envío gratis en pedidos +€15 (ahorra €2.50-€5 por pedido)",
    "5% de descuento en cada compra",
    "Soporte prioritario 24/7",
    "Ofertas exclusivas y acceso anticipado",
    "Recuperas tu inversión con 3 pedidos al mes",
  ];
  const businessBenefits = [
    "Comisión reducida del 15% al 10%",
    "Negocio destacado en búsquedas y mapa",
    "Estadísticas avanzadas de ventas y clientes",
    "Soporte VIP con gestor personal",
    "Herramientas de promoción y fidelización",
  ];
  const queryClient = useQueryClient();

  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [paymentModal, setPaymentModal] = useState<{
    plan: string;
    amount: number; // en centavos
  } | null>(null);

  // ── Suscripción actual del usuario ──────────────────────────────────────
  const { data: subscriptionData, refetch: refetchSubscription } = useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/subscriptions/my-subscription");
        if (!response.ok) return null;
        const data = await response.json();
        return data.success ? data.subscription : null;
      } catch {
        return null;
      }
    },
    enabled: !!user?.id,
    staleTime: 0,           // Siempre considerar datos como obsoletos
    refetchOnMount: "always", // Refrescar siempre al montar
  });

  // Refrescar suscripción cada vez que la pantalla recibe el foco
  // (e.g., al volver de StripePaymentScreen)
  useFocusEffect(
    useCallback(() => {
      refetchSubscription();
    }, [refetchSubscription]),
  );

  // ── Planes disponibles (BD o fallback) ──────────────────────────────────
  const { data: plansData } = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/subscriptions/plans");
      const data = await response.json();
      return data.success ? data.plans : null;
    },
  });

  // ── Iniciar suscripción ──────────────────────────────────────────────────
  const initMutation = useMutation({
    mutationFn: async (plan: string) => {
      const response = await apiRequest("POST", "/api/subscriptions/subscribe", {
        plan,
        billingCycle: "monthly",
      });
      return response.json();
    },
  });

  // ── Cancelar suscripción ─────────────────────────────────────────────────
  const cancelMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/subscriptions/cancel");
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || "No se pudo cancelar la suscripción");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription", user?.id] });
      Alert.alert(
        "Suscripción cancelada",
        "Seguirás teniendo acceso hasta el final del período de facturación.",
      );
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "No se pudo cancelar la suscripción");
    },
  });

  // ── Valores derivados ────────────────────────────────────────────────────
  const currentPlan = subscriptionData?.plan || "free";
  const isActive = subscriptionData?.status === "active";
  const isPendingPayment = subscriptionData?.status === "pending_payment";
  const isCancelledAtPeriodEnd =
    isActive && !!subscriptionData?.cancelledAt && !subscriptionData?.autoRenew;

  // Precio desde BD o fallback (en centavos) — planes Soria 2026
  const getPlanPrice = (plan: string): number => {
    const dbPrice = plansData?.[plan]?.price;
    if (dbPrice != null && dbPrice > 0) return dbPrice;
    const fallback: Record<string, number> = {
      soria_local: 499,
      impulso_local: 2900,
      top_soria: 7900,
      premium_soria: 9900,
      logistica_local: 3900,
      escaparate_soria: 1900,
      express_semana: 4900,
    };
    return fallback[plan] ?? 0;
  };

  // ── Seleccionar método de pago ───────────────────────────────────────────
  const handleSubscribePress = (plan: string) => {
    const amount = getPlanPrice(plan); // centavos
    setPaymentModal({ plan, amount });
  };

  const handlePaymentMethodSelect = async (methodId: string) => {
    if (!paymentModal) return;
    const { plan, amount } = paymentModal;
    setPaymentModal(null);

    // Crear suscripción en pending_payment
    let subscriptionId: string;
    try {
      const data = await initMutation.mutateAsync(plan);
      if (!data.success || !data.subscriptionId) {
        Alert.alert("Error", data.error || "No se pudo iniciar la suscripción");
        return;
      }
      subscriptionId = data.subscriptionId;
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo conectar con el servidor");
      return;
    }

    if (methodId === "stripe_card") {
      // Pago instantáneo con Stripe — amount en centavos, StripePaymentScreen lo divide para mostrar
      navigation.navigate("StripePayment", {
        orderId: subscriptionId,
        amount,          // centavos (1500 → €15)
        subtotal: amount,
        deliveryFee: 0,
        businessId: "",
        isSubscription: true,
        subscriptionId,
        provider: methodId,
      } as any);
    } else {
      // Pago manual con comprobante (Bizum / PayPal)
      const paymentMethod = methodId === "paypal_manual" ? "paypal" : "bizum";
      navigation.navigate("PaymentProof", {
        orderId: subscriptionId,
        amount,           // centavos (1500 → €15)
        paymentMethod,
        subscriptionId,
      });
    }
  };

  // ── Botón suscribirse ────────────────────────────────────────────────────
  const renderSubscribeButton = (plan: string) => {
    if (currentPlan === plan && isActive) return null;
    if (isPendingPayment && currentPlan === plan) return null;
    const priceEur = (getPlanPrice(plan) / 100).toFixed(2).replace(".", ",");
    return (
      <TouchableOpacity
        style={styles.subscribeButton}
        onPress={() => handleSubscribePress(plan)}
        disabled={initMutation.isPending}
      >
        <Text style={styles.subscribeButtonText}>
          {initMutation.isPending
            ? "Procesando..."
            : `Suscribirme — ${priceEur} €/mes`}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <ThemedView style={styles.container}>
      {/* Cabecera */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h3" style={styles.headerTitle}>
          ComeYa Premium
        </ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── SUSCRIPCIÓN ACTIVA ────────────────────────────────────────── */}
        {isActive && currentPlan !== "free" && (
          <View style={[
            styles.currentPlanCard,
            isCancelledAtPeriodEnd && { borderColor: "#F59E0B", borderWidth: 2 },
          ]}>
            <Text style={styles.currentPlanTitle}>
              {isCancelledAtPeriodEnd ? "⚠️ Cancelación programada" : "✅ Plan Activo"}
            </Text>
            <Text style={[
              styles.currentPlanName,
              isCancelledAtPeriodEnd && { color: "#F59E0B" },
            ]}>
              {currentPlan === "premium" ? "Premium" : "Business"}
            </Text>
            <Text style={styles.currentPlanPrice}>
              {centsToDisplay(
                plansData?.[currentPlan]?.price ?? (currentPlan === "premium" ? 1500 : 3000),
              )} €/mes
            </Text>

            {/* Fechas inicio / fin del período */}
            <View style={styles.datesRow}>
              <View style={styles.dateBox}>
                <Feather name="calendar" size={13} color="#888" />
                <Text style={styles.dateLabel}> Inicio</Text>
                <Text style={styles.dateValue}>
                  {formatDate(subscriptionData?.currentPeriodStart)}
                </Text>
              </View>
              <View style={styles.dateDivider} />
              <View style={styles.dateBox}>
                <Feather name="calendar" size={13} color={isCancelledAtPeriodEnd ? "#F59E0B" : "#888"} />
                <Text style={[styles.dateLabel, isCancelledAtPeriodEnd && { color: "#F59E0B" }]}>
                  {isCancelledAtPeriodEnd ? " Expira" : " Próx. renovación"}
                </Text>
                <Text style={[styles.dateValue, isCancelledAtPeriodEnd && { color: "#F59E0B", fontWeight: "700" }]}>
                  {formatDate(subscriptionData?.currentPeriodEnd)}
                </Text>
              </View>
            </View>

            {isCancelledAtPeriodEnd ? (
              <Text style={styles.cancelledHint}>
                Tu acceso termina el {formatDate(subscriptionData?.currentPeriodEnd)}.
                Para reactivar, suscríbete de nuevo al final del período.
              </Text>
            ) : (
              <>
                <Text style={styles.currentPlanHint}>
                  La suscripción se renueva automáticamente cada mes.{"\n"}
                  Para cambiar de plan, cancela este primero.
                </Text>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() =>
                    Alert.alert(
                      "Cancelar suscripción",
                      "¿Estás seguro? Seguirás teniendo acceso hasta el final del período de facturación.",
                      [
                        { text: "No, mantener", style: "cancel" },
                        {
                          text: "Sí, cancelar",
                          style: "destructive",
                          onPress: () => cancelMutation.mutate(),
                        },
                      ],
                    )
                  }
                  disabled={cancelMutation.isPending}
                >
                  <Feather name="x-circle" size={16} color="white" style={{ marginRight: 6 }} />
                  <Text style={styles.cancelButtonText}>
                    {cancelMutation.isPending ? "Cancelando..." : "Cancelar suscripción"}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* ── PAGO PENDIENTE ────────────────────────────────────────────── */}
        {isPendingPayment && (
          <View style={[styles.currentPlanCard, { borderWidth: 2, borderColor: "#F59E0B" }]}>
            <Text style={{ fontSize: 28, textAlign: "center" }}>⏳</Text>
            <Text style={[styles.currentPlanName, { color: "#F59E0B", marginTop: 8 }]}>
              Verificando pago
            </Text>
            <Text style={[styles.currentPlanTitle, { marginTop: 4 }]}>
              Plan {currentPlan === "premium" ? "Premium" : "Business"} — pendiente de activación
            </Text>
            <Text style={{ fontSize: 13, color: "#888", textAlign: "center", marginTop: 8 }}>
              Recibirás una notificación cuando se active (5-15 min).
            </Text>

            {/* Continuar con el pago */}
            {subscriptionData && (
              <TouchableOpacity
                style={[styles.continuePaymentButton, { marginTop: 12 }]}
                onPress={() => {
                  const amount =
                    subscriptionData.price != null && subscriptionData.price > 0
                      ? subscriptionData.price
                      : getPlanPrice(subscriptionData.plan === "business" ? "business" : "premium");
                  setPaymentModal({
                    plan: subscriptionData.plan === "business" ? "business" : "premium",
                    amount,
                  });
                }}
              >
                <Text style={styles.continuePaymentButtonText}>Continuar con el pago</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.cancelButton, { marginTop: 12, backgroundColor: "#6B7280" }]}
              onPress={() =>
                Alert.alert(
                  "Cancelar pago pendiente",
                  "¿Seguro? Podrás suscribirte de nuevo cuando quieras.",
                  [
                    { text: "No", style: "cancel" },
                    {
                      text: "Sí, cancelar",
                      onPress: async () => {
                        await apiRequest("POST", "/api/subscriptions/cancel-pending");
                        queryClient.invalidateQueries({ queryKey: ["subscription", user?.id] });
                      },
                    },
                  ],
                )
              }
            >
              <Text style={styles.cancelButtonText}>Cancelar pago pendiente</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Título sección planes */}
        {isActive && currentPlan !== "free" ? (
          <Text style={styles.sectionTitle}>Cambiar de plan</Text>
        ) : (
          <Text style={styles.sectionTitle}>Elige tu plan</Text>
        )}

        {/* ── PLANES DINÁMICOS (7 planes ComeYa Soria desde BD) ────────── */}
        {(() => {
          // Planes legacy (premium/business) retirados: solo los 7 de ComeYa
          const BUSINESS_PLAN_KEYS = [
            "impulso_local",
            "top_soria",
            "premium_soria",
            "logistica_local",
            "escaparate_soria",
            "express_semana",
          ];
          const allPlans = plansData ? Object.keys(plansData) : [];
          const visiblePlans = allPlans.filter((planKey) => {
            const p = plansData[planKey];
            if (!p?.price) return false;
            // Cliente → soria_local; negocio → los 6 planes de negocio
            return isBusinessOwner
              ? BUSINESS_PLAN_KEYS.includes(planKey)
              : planKey === "soria_local";
          });

          return visiblePlans.map((planKey) => {
            const p = plansData[planKey];
            if (currentPlan === planKey && isActive) return null;
            const cycle = p.billingCycle === "weekly" ? "semana" : "mes";
            const color = (p.color || "#DC2626").replace("#", "");
            // Beneficios priorizando la lista real de la BD; el texto de
            // description es solo respaldo (se separa por saltos de línea)
            const benefitsText: string[] =
              Array.isArray(p.benefitsList) && p.benefitsList.length > 0
                ? p.benefitsList
                    .map((b: any) => b.description)
                    .filter((d: any) => !!d)
                : (p.description || "")
                    .split("\n")
                    .map((t: string) => t.trim())
                    .filter((t: string) => t.length > 0);
            return (
              <TouchableOpacity
                key={planKey}
                style={[
                  styles.planCard,
                  selectedPlan === planKey && styles.planCardSelected,
                ]}
                onPress={() => setSelectedPlan(planKey)}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={[`#${color}`, `#${color}CC`]}
                  style={styles.planGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.planName}>{p.name}</Text>
                  <Text style={styles.planPrice}>
                    {formatCurrency(p.price)}/{cycle}
                  </Text>
                </LinearGradient>
                <View style={styles.planBenefits}>
                  {benefitsText.map((b: string) => (
                    <View key={b} style={styles.benefit}>
                      <Text style={styles.benefitIcon}>✅</Text>
                      <Text style={styles.benefitText}>{b}</Text>
                    </View>
                  ))}
                </View>
                {renderSubscribeButton(planKey)}
              </TouchableOpacity>
            );
          });
        })()}

        {/* ── SECCIÓN BENEFICIOS ───────────────────────────────────────── */}
        <View style={styles.comparisonCard}>
          <Text style={styles.comparisonTitle}>¿Por qué suscribirse?</Text>
          {[
            "🚚  Ahorra en envíos y comisiones cada mes",
            "💰  Con pocos pedidos recuperas tu inversión",
            "🏪  Más visibilidad para tu negocio en Soria",
            "⚡  Prioridad de repartidores en horas punta",
            "🔓  Cancela cuando quieras, sin permanencia",
          ].map((item) => (
            <Text key={item} style={styles.comparisonText}>{item}</Text>
          ))}
        </View>
      </ScrollView>

      {/* ── MODAL MÉTODO DE PAGO ─────────────────────────────────────────── */}
      <Modal
        visible={!!paymentModal}
        transparent
        animationType="slide"
        onRequestClose={() => setPaymentModal(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPaymentModal(null)}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>¿Cómo quieres pagar?</Text>
            <Text style={styles.modalSub}>
              Plan {paymentModal?.plan === "premium" ? "Premium" : "Business"} —{" "}
              {paymentModal ? (paymentModal.amount / 100).toFixed(0) : "0"} €/mes
            </Text>

            {PAYMENT_METHODS.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={styles.methodRow}
                onPress={() => handlePaymentMethodSelect(m.id)}
                activeOpacity={0.8}
              >
                <View style={[styles.methodIcon, { backgroundColor: m.color + "18" }]}>
                  <Feather name={m.icon as any} size={22} color={m.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.methodLabel}>{m.label}</Text>
                  <Text style={styles.methodSub}>{m.sub}</Text>
                </View>
                {m.instant && (
                  <View style={styles.instantBadge}>
                    <Text style={styles.instantText}>Instantáneo</Text>
                  </View>
                )}
                <Feather name="chevron-right" size={18} color="#ccc" />
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setPaymentModal(null)}
            >
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: ComeYaColors.border,
  },
  backButton: { padding: Spacing.sm },
  headerTitle: { flex: 1, textAlign: "center" },

  content: { flex: 1, padding: 20 },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#444",
    marginBottom: 12,
    marginTop: 4,
  },

  currentPlanCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  currentPlanTitle: { fontSize: 14, color: "#888", marginBottom: 8 },
  currentPlanName: { fontSize: 26, fontWeight: "bold", marginBottom: 4 },
  currentPlanPrice: { fontSize: 20, color: ComeYaColors.primary, fontWeight: "700", marginBottom: 12 },
  currentPlanHint: {
    fontSize: 12,
    color: "#999",
    textAlign: "center",
    marginBottom: 16,
    paddingHorizontal: 8,
    lineHeight: 18,
  },
  cancelledHint: {
    fontSize: 13,
    color: "#F59E0B",
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 8,
    lineHeight: 18,
  },

  // Fechas inicio/fin
  datesRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    width: "100%",
    backgroundColor: "#F8F9FA",
    borderRadius: 10,
    padding: 10,
  },
  dateBox: {
    flex: 1,
    alignItems: "center",
    flexDirection: "column",
  },
  dateLabel: {
    fontSize: 11,
    color: "#888",
    marginTop: 2,
  },
  dateValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
    marginTop: 2,
    textAlign: "center",
  },
  dateDivider: {
    width: 1,
    height: 36,
    backgroundColor: "#E0E0E0",
    marginHorizontal: 8,
  },

  cancelButton: {
    backgroundColor: "#FF5252",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  cancelButtonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 15,
  },

  planCard: {
    backgroundColor: "white",
    borderRadius: 12,
    marginBottom: 20,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  planCardSelected: { borderColor: ComeYaColors.primary },
  planGradient: { padding: 24, alignItems: "center" },

  planName: {
    fontSize: 28,
    fontWeight: "bold",
    color: "white",
    marginBottom: 8,
  },
  planPrice: { fontSize: 32, fontWeight: "bold", color: "white" },
  planBenefits: { padding: 20 },
  benefit: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  benefitIcon: { fontSize: 16, marginRight: 10 },
  benefitText: { fontSize: 14, color: "#333", flex: 1, lineHeight: 20 },

  subscribeButton: {
    backgroundColor: ComeYaColors.primary,
    margin: 20,
    marginTop: 0,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  subscribeButtonText: { color: "white", fontSize: 16, fontWeight: "700" },

  comparisonCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    marginTop: 4,
    marginBottom: 40,
  },
  comparisonTitle: { fontSize: 18, fontWeight: "700", marginBottom: 14 },
  comparisonText: { fontSize: 14, color: "#555", marginBottom: 10, lineHeight: 20 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
  modalSub: { fontSize: 14, color: "#888", marginBottom: 20 },
  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 12,
  },
  methodIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  methodLabel: { fontSize: 15, fontWeight: "600", color: "#111" },
  methodSub: { fontSize: 12, color: "#888", marginTop: 2 },
  instantBadge: {
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  instantText: { fontSize: 11, color: "#065F46", fontWeight: "600" },
  modalCancel: { marginTop: 16, alignItems: "center", paddingVertical: 12 },
  modalCancelText: { fontSize: 15, color: "#888" },

  continuePaymentButton: {
    backgroundColor: ComeYaColors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
  },
  continuePaymentButtonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 16,
  },
});
