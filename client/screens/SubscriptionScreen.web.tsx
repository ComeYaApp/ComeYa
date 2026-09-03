import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Text,
  ActivityIndicator,
  Modal,
  TouchableOpacity,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { apiRequest } from "@/lib/query-client";
import { MobileSidebarWrapper } from "@/components/MobileSidebarWrapper";
import { WebLayout } from "@/components/WebLayout";

const PRIMARY = "#E60000";

const PAYMENT_METHODS = [
  {
    id: "stripe_card",
    icon: "credit-card",
    color: "#635BFF",
    label: "Tarjeta",
    sub: "Visa, Mastercard — pago instantáneo",
    instant: true,
  },
  {
    id: "stripe_bizum",
    icon: "smartphone",
    color: "#00ADEF",
    label: "Bizum (Stripe)",
    sub: "Pago instantáneo desde tu app bancaria",
    instant: true,
  },
  {
    id: "bizum_manual",
    icon: "smartphone",
    color: "#00ADEF",
    label: "Bizum (manual)",
    sub: "Transferencia + subir comprobante",
    instant: false,
  },
];

export default function SubscriptionScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [paymentModal, setPaymentModal] = useState<{
    plan: string;
    amount: number;
    subscriptionId: string;
  } | null>(null);

  const handlePaymentMethodSelect = (methodId: string) => {
    if (!paymentModal) return;
    const { plan, amount, subscriptionId } = paymentModal;
    setPaymentModal(null);
    if (methodId === "stripe_card" || methodId === "stripe_bizum") {
      navigation.navigate(
        "StripePayment" as never,
        {
          orderId: subscriptionId,
          amount,
          subtotal: amount,
          deliveryFee: 0,
          businessId: "",
          isSubscription: true,
          subscriptionId,
        } as never,
      );
    } else {
      navigation.navigate(
        "PaymentProof" as never,
        {
          orderId: subscriptionId,
          amount,
          paymentMethod: "bizum",
          subscriptionId,
        } as never,
      );
    }
  };

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const cardBg = isDark ? "#2a2a2a" : "#f9fafb";

  const { data: subscriptionData } = useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/subscriptions/my-subscription");
      const d = await res.json();
      return d.success ? d.subscription : null;
    },
    enabled: !!user?.id,
  });

  const { data: plansData } = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/subscriptions/plans");
      const d = await res.json();
      return d.success ? d.plans : null;
    },
  });

  // Planes legacy (premium/business) retirados: solo los 7 de ComeYa
  const BUSINESS_PLAN_KEYS = [
    "impulso_local",
    "top_soria",
    "premium_soria",
    "logistica_local",
    "escaparate_soria",
    "express_semana",
  ];
  const isBusinessOwner = user?.role === "business_owner";
  const visiblePlans: Array<{ key: string; plan: any }> = plansData
    ? Object.keys(plansData)
        .filter((k) => {
          const p = plansData[k];
          if (!p?.price) return false;
          return isBusinessOwner
            ? BUSINESS_PLAN_KEYS.includes(k)
            : k === "soria_local";
        })
        .map((k) => ({ key: k, plan: plansData[k] }))
    : [];

  const planLabel = (key: string) =>
    plansData?.[key]?.name ||
    (key === "premium" ? "Premium" : key === "business" ? "Business" : key);

  const subscribeMutation = useMutation({
    mutationFn: async (plan: string) => {
      const res = await apiRequest("POST", "/api/subscriptions/subscribe", {
        plan,
        billingCycle: "monthly",
      });
      return res.json();
    },
    onSuccess: (data, plan) => {
      if (data.success && data.subscriptionId) {
        setPaymentModal({
          plan,
          amount: plansData?.[plan]?.price || 0,
          subscriptionId: data.subscriptionId,
        });
      } else {
        showToast(data.error || "Error al iniciar suscripción", "error");
      }
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/subscriptions/cancel");
      return res.json();
    },
    onSuccess: () => {
      showToast("Suscripción cancelada", "success");
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
    },
  });

  const currentPlan = subscriptionData?.plan || "free";
  const isActive = subscriptionData?.status === "active";
  const isPending = subscriptionData?.status === "pending_payment";

  // NAV: los planes visibles del usuario
  const NAV_ITEMS = visiblePlans.map(({ key, plan }) => ({
    id: key,
    label: plan.name || key,
    icon: key === "top_soria" ? "star" : "zap",
  }));

  // Seleccionar el primer plan visible por defecto
  useEffect(() => {
    if (!selectedPlan && visiblePlans.length > 0) {
      setSelectedPlan(visiblePlans[0].key);
    }
  }, [visiblePlans]);

  return (
    <WebLayout>
      <View style={[s.root, { backgroundColor: bg }]}>
        {/* Sidebar */}
        <MobileSidebarWrapper
          title="Suscripciones"
          sidebarStyle={[
            s.sidebar,
            { backgroundColor: card, borderRightColor: border },
          ]}
        >
          <View style={[s.sideHeader, { borderBottomColor: border }]}>
            <View style={[s.sideIconWrap, { backgroundColor: PRIMARY + "15" }]}>
              <Feather name="award" size={36} color={PRIMARY} />
            </View>
            <Text style={[s.sideTitle, { color: text }]}>ComeYa Premium</Text>
            <Text style={[s.sideSub, { color: sub }]}>
              Elige el plan que mejor se adapte a ti
            </Text>

            {isActive && currentPlan !== "free" ? (
              <View
                style={[
                  s.activeBadge,
                  { backgroundColor: "#10B98120", borderColor: "#10B98140" },
                ]}
              >
                <Feather name="check-circle" size={13} color="#10B981" />
                <Text style={[s.activeBadgeText, { color: "#10B981" }]}>
                  Plan {planLabel(currentPlan)} activo
                </Text>
              </View>
            ) : (
              <View
                style={[
                  s.activeBadge,
                  { backgroundColor: cardBg, borderColor: border },
                ]}
              >
                <Feather name="circle" size={13} color={sub} />
                <Text style={[s.activeBadgeText, { color: sub }]}>
                  Plan gratuito
                </Text>
              </View>
            )}
          </View>

          <View style={s.sideNav}>
            {NAV_ITEMS.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setSelectedPlan(item.id as any)}
                style={[s.navItem, selectedPlan === item.id && s.navItemActive]}
              >
                <Feather
                  name={item.icon as any}
                  size={18}
                  color={selectedPlan === item.id ? PRIMARY : sub}
                />
                <Text
                  style={[
                    s.navItemText,
                    { color: selectedPlan === item.id ? PRIMARY : text },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={[s.sideFooter, { borderTopColor: border }]}>
            <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
              <Feather name="arrow-left" size={16} color={sub} />
              <Text style={[s.backBtnText, { color: text }]}>Volver</Text>
            </Pressable>
          </View>
        </MobileSidebarWrapper>

        {/* Main */}
        <ScrollView
          style={s.main}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Plan activo banner */}
          {isActive && currentPlan !== "free" && (
            <View
              style={[
                s.currentBanner,
                { backgroundColor: "#10B98115", borderColor: "#10B98130" },
              ]}
            >
              <Feather name="check-circle" size={20} color="#10B981" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[s.currentBannerTitle, { color: text }]}>
                  Plan {planLabel(currentPlan)} activo
                </Text>
                {plansData?.[currentPlan] && (
                  <Text style={[s.currentBannerSub, { color: sub }]}>
                    {(plansData[currentPlan].price / 100).toFixed(2)} €/mes
                  </Text>
                )}
              </View>
              <Pressable
                onPress={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                style={[s.cancelBannerBtn, { borderColor: "#EF4444" }]}
              >
                {cancelMutation.isPending ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <Text
                    style={{
                      color: "#EF4444",
                      fontSize: 13,
                      fontWeight: "600",
                    }}
                  >
                    Cancelar
                  </Text>
                )}
              </Pressable>
            </View>
          )}

          {/* Pago pendiente banner */}
          {isPending && (
            <View
              style={[
                s.currentBanner,
                { backgroundColor: "#FEF3C715", borderColor: "#F59E0B40" },
              ]}
            >
              <Feather name="clock" size={20} color="#F59E0B" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[s.currentBannerTitle, { color: text }]}>
                  ⏳ Verificando pago
                </Text>
                <Text style={[s.currentBannerSub, { color: sub }]}>
                  Plan {planLabel(currentPlan)} — pendiente de activación
                  (5-15 min)
                </Text>
              </View>
              <Pressable
                style={[s.cancelBannerBtn, { borderColor: "#6B7280" }]}
                onPress={async () => {
                  await apiRequest("POST", "/api/subscriptions/cancel-pending");
                  queryClient.invalidateQueries({ queryKey: ["subscription"] });
                  showToast("Pago pendiente cancelado", "success");
                }}
              >
                <Text
                  style={{ color: "#6B7280", fontSize: 13, fontWeight: "600" }}
                >
                  Cancelar
                </Text>
              </Pressable>
            </View>
          )}

          {/* Cards de planes */}
          <View style={s.plansRow}>
            {visiblePlans.map(({ key, plan }) => {
              const isSelected = selectedPlan === key;
              const isCurrent = currentPlan === key && isActive;
              const color = plan.color || PRIMARY;
              const benefitsList: string[] =
                Array.isArray(plan.benefitsList) &&
                plan.benefitsList.length > 0
                  ? plan.benefitsList
                      .map((b: any) => b.description)
                      .filter((d: any) => !!d)
                  : (plan.description || "")
                      .split("\n")
                      .map((t: string) => t.trim())
                      .filter((t: string) => t.length > 0);
              return (
                <Pressable
                  key={key}
                  onPress={() => setSelectedPlan(key)}
                  style={[
                    s.planCard,
                    {
                      backgroundColor: card,
                      borderColor: isSelected ? PRIMARY : border,
                    },
                  ]}
                >
                  {/* Header con gradiente simulado */}
                  <View style={[s.planHeader, { backgroundColor: color }]}>
                    {isCurrent && (
                      <View style={s.currentPill}>
                        <Text style={s.currentPillText}>Activo</Text>
                      </View>
                    )}
                    <Text style={s.planName}>{plan.name}</Text>
                    <Text style={s.planPrice}>
                      {(plan.price / 100).toFixed(2)} €/
                      {plan.billingCycle === "weekly" ? "semana" : "mes"}
                    </Text>
                  </View>

                  {/* Beneficios */}
                  <View style={s.planBody}>
                    {benefitsList.map((b, i) => (
                      <View key={i} style={s.benefitRow}>
                        <View
                          style={[s.benefitDot, { backgroundColor: PRIMARY }]}
                        />
                        <Text style={[s.benefitText, { color: text }]}>
                          {b}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* CTA */}
                  <View style={[s.planFooter, { borderTopColor: border }]}>
                    {isCurrent ? (
                      <View
                        style={[s.ctaBtn, { backgroundColor: "#10B98120" }]}
                      >
                        <Feather name="check" size={16} color="#10B981" />
                        <Text
                          style={{
                            color: "#10B981",
                            fontWeight: "700",
                            marginLeft: 6,
                          }}
                        >
                          Plan actual
                        </Text>
                      </View>
                    ) : isPending && currentPlan === key ? (
                      <View style={[s.ctaBtn, { backgroundColor: "#FEF3C7" }]}>
                        <Feather name="clock" size={16} color="#F59E0B" />
                        <Text
                          style={{
                            color: "#F59E0B",
                            fontWeight: "700",
                            marginLeft: 6,
                          }}
                        >
                          Verificando pago...
                        </Text>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => subscribeMutation.mutate(key)}
                        disabled={subscribeMutation.isPending}
                        style={[s.ctaBtn, { backgroundColor: PRIMARY }]}
                      >
                        {subscribeMutation.isPending ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Feather name="zap" size={16} color="#fff" />
                            <Text
                              style={{
                                color: "#fff",
                                fontWeight: "700",
                                marginLeft: 6,
                              }}
                            >
                              Suscribirme — Pagar{" "}
                              {(plan.price / 100).toFixed(2)} €
                            </Text>
                          </>
                        )}
                      </Pressable>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Comparativa */}
          <View
            style={[s.infoCard, { backgroundColor: card, borderColor: border }]}
          >
            <View style={s.infoCardHeader}>
              <Feather name="info" size={18} color={PRIMARY} />
              <Text style={[s.infoCardTitle, { color: text }]}>
                ¿Por qué suscribirse?
              </Text>
            </View>
            <View style={s.infoRow}>
              <Feather name="trending-up" size={15} color="#10B981" />
              <Text style={[s.infoText, { color: sub }]}>
                Ahorra hasta €150 al mes en envíos y descuentos
              </Text>
            </View>
            <View style={s.infoRow}>
              <Feather name="package" size={15} color="#10B981" />
              <Text style={[s.infoText, { color: sub }]}>
                Con solo 2 pedidos al mes ya recuperas tu inversión
              </Text>
            </View>
            <View style={s.infoRow}>
              <Feather name="shield" size={15} color="#10B981" />
              <Text style={[s.infoText, { color: sub }]}>
                Cancela cuando quieras, sin permanencia
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Modal selector de método de pago */}
        <Modal
          visible={!!paymentModal}
          transparent
          animationType="slide"
          onRequestClose={() => setPaymentModal(null)}
        >
          <TouchableOpacity
            style={ms.overlay}
            activeOpacity={1}
            onPress={() => setPaymentModal(null)}
          >
            <View style={[ms.sheet, { backgroundColor: card }]}>
              <View style={ms.handle} />
              <Text style={[ms.title, { color: text }]}>
                ¿Cómo quieres pagar?
              </Text>
              <Text style={[ms.subtitle, { color: sub }]}>
                Plan {paymentModal ? planLabel(paymentModal.plan) : ""} —{" "}
                {((paymentModal?.amount || 0) / 100).toFixed(2)} €/mes
              </Text>
              {PAYMENT_METHODS.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[ms.row, { borderBottomColor: border }]}
                  onPress={() => handlePaymentMethodSelect(m.id)}
                >
                  <View style={[ms.icon, { backgroundColor: m.color + "18" }]}>
                    <Feather name={m.icon as any} size={22} color={m.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[ms.label, { color: text }]}>{m.label}</Text>
                    <Text style={[ms.msub, { color: sub }]}>{m.sub}</Text>
                  </View>
                  {m.instant && (
                    <View style={ms.badge}>
                      <Text style={ms.badgeText}>Instantáneo</Text>
                    </View>
                  )}
                  <Feather name="chevron-right" size={18} color="#ccc" />
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={ms.cancel}
                onPress={() => setPaymentModal(null)}
              >
                <Text style={{ color: sub, fontSize: 15 }}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    </WebLayout>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", overflow: "hidden" as any },
  sidebar: { width: 280, borderRightWidth: 1, flexDirection: "column" as any },
  sideHeader: { padding: 24, alignItems: "center", borderBottomWidth: 1 },
  sideIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  sideTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
    textAlign: "center",
  },
  sideSub: { fontSize: 12, textAlign: "center", marginBottom: 12 },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  activeBadgeText: { fontSize: 12, fontWeight: "600" },
  sideNav: { flex: 1, paddingVertical: 16 },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  navItemActive: {
    backgroundColor: "#E6000010",
    borderRightWidth: 3,
    borderRightColor: PRIMARY,
  },
  navItemText: { fontSize: 14, fontWeight: "600" },
  sideFooter: { borderTopWidth: 1, padding: 16 },
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
  content: { padding: 32, maxWidth: 860, paddingBottom: 80 },
  currentBanner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  currentBannerTitle: { fontSize: 15, fontWeight: "700" },
  currentBannerSub: { fontSize: 13, marginTop: 2 },
  cancelBannerBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  plansRow: { flexDirection: "row", gap: 20, marginBottom: 24 },
  planCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 2,
    overflow: "hidden" as any,
  },
  planHeader: {
    padding: 24,
    alignItems: "center",
    position: "relative" as any,
  },
  currentPill: {
    position: "absolute" as any,
    top: 12,
    right: 12,
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  currentPillText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  planName: { fontSize: 26, fontWeight: "800", color: "#fff", marginBottom: 6 },
  planPrice: {
    fontSize: 20,
    fontWeight: "700",
    color: "rgba(255,255,255,0.9)",
  },
  planBody: { padding: 20, gap: 10 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  benefitDot: { width: 7, height: 7, borderRadius: 4 },
  benefitText: { fontSize: 14, flex: 1 },
  planFooter: { borderTopWidth: 1, padding: 16 },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 10,
  },
  infoCard: { borderRadius: 16, borderWidth: 1, padding: 20, gap: 12 },
  infoCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  infoCardTitle: { fontSize: 16, fontWeight: "700" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoText: { fontSize: 14, flex: 1 },
});

const ms = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
  subtitle: { fontSize: 14, marginBottom: 20 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  label: { fontSize: 15, fontWeight: "600" },
  msub: { fontSize: 12, marginTop: 2 },
  badge: {
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeText: { fontSize: 11, color: "#065F46", fontWeight: "600" },
  cancel: { marginTop: 16, alignItems: "center", paddingVertical: 12 },
});
