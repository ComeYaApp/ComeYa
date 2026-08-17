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
import { Image } from "expo-image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { apiRequest } from "@/lib/query-client";
import { MobileSidebarWrapper } from "@/components/MobileSidebarWrapper";

import { WebLayout } from "@/components/WebLayout";

const PRIMARY = "#DC2626";
const PRESETS = [10, 25, 50, 100];

const STATUS_LABELS: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  pending_payment: {
    label: "Pendiente de pago",
    color: "#F59E0B",
    icon: "clock",
  },
  pending_verification: {
    label: "Verificando pago",
    color: "#3B82F6",
    icon: "search",
  },
  active: { label: "Activa", color: "#10B981", icon: "check-circle" },
  redeemed: { label: "Canjeada", color: "#6B7280", icon: "check" },
  expired: { label: "Expirada", color: "#EF4444", icon: "x-circle" },
  rejected: { label: "Rechazada", color: "#EF4444", icon: "x-circle" },
};

function daysUntil(date: string | null) {
  if (!date) return null;
  const diff = new Date(date).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function GiftCardsScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"buy" | "my-cards">("buy");
  const [amount, setAmount] = useState("25");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [message, setMessage] = useState("");
  const [selectedDesign, setSelectedDesign] = useState("default");
  const [paymentMethod, setPaymentMethod] = useState<
    "stripe" | "bizum_manual" | "sepa"
  >("stripe");

  const [proofCardId, setProofCardId] = useState<string | null>(null);
  const [proofProvider, setProofProvider] = useState("bizum");
  const [proofRef, setProofRef] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [proofUploading, setProofUploading] = useState(false);

  const handlePickProof = async () => {
    setProofUploading(true);
    try {
      const { pickAndUploadImage } = await import("@/utils/uploadImageWeb");
      const url = await pickAndUploadImage("comprobantes");
      if (url) setProofUrl(url);
    } finally {
      setProofUploading(false);
    }
  };

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const cardBg = isDark ? "#2a2a2a" : "#f9fafb";

  const { data: designsData } = useQuery({
    queryKey: ["/api/gift-cards/designs"],
    queryFn: async () =>
      (await apiRequest("GET", "/api/gift-cards/designs")).json(),
  });
  const { data: myCardsData, refetch: refetchCards } = useQuery({
    queryKey: ["/api/gift-cards/my-cards"],
    queryFn: async () =>
      (await apiRequest("GET", "/api/gift-cards/my-cards")).json(),
  });

  const purchaseMutation = useMutation({
    mutationFn: async () =>
      (
        await apiRequest("POST", "/api/gift-cards/purchase", {
          amount: parseFloat(amount),
          recipientEmail: recipientEmail.trim() || undefined,
          message: message.trim() || undefined,
          design: selectedDesign,
          paymentMethod,
        })
      ).json(),
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({
          queryKey: ["/api/gift-cards/my-cards"],
        });
        if (paymentMethod === "stripe") {
          // Redirigir a Stripe igual que un pedido
          navigation.navigate(
            "StripePayment" as never,
            {
              giftCardId: data.giftCard.id,
              amount: Math.round(parseFloat(amount) * 100),
              isGiftCard: true,
            } as never,
          );
        } else {
          showToast(
            "Gift Card creada. Ahora sube el comprobante de pago.",
            "success",
          );
          setProofCardId(data.giftCard.id);
          setActiveTab("my-cards");
        }
        setAmount("25");
        setRecipientEmail("");
        setMessage("");
      } else showToast(data.error || "Error al crear gift card", "error");
    },
  });

  const proofMutation = useMutation({
    mutationFn: async (giftCardId: string) =>
      (
        await apiRequest(
          "POST",
          `/api/gift-cards/${giftCardId}/payment-proof`,
          {
            paymentProvider: proofProvider,
            proofImageUrl: proofUrl.trim(),
            referenceNumber: proofRef.trim() || undefined,
            amount: parseFloat(amount),
          },
        )
      ).json(),
    onSuccess: (data) => {
      if (data.success) {
        showToast(
          "Comprobante enviado. El admin lo verificará pronto.",
          "success",
        );
        setProofCardId(null);
        setProofRef("");
        setProofUrl("");
        refetchCards();
      } else showToast(data.error || "Error al enviar comprobante", "error");
    },
  });

  const designs = designsData?.designs || [];
  const myCards = myCardsData?.purchased || [];
  const canBuy =
    !!amount && parseFloat(amount) >= 10 && !purchaseMutation.isPending;
  const canProof = !!proofUrl.trim() && !proofMutation.isPending;

  const TABS = [
    { id: "buy", label: "Comprar", icon: "gift" },
    { id: "my-cards", label: "Mis Tarjetas", icon: "credit-card" },
  ];

  const PROVIDERS = ["bizum", "transferencia", "stripe"];

  return (
    <WebLayout>
      <View style={[s.root, { backgroundColor: bg }]}>
        <MobileSidebarWrapper
          title="Gift Cards"
          sidebarStyle={[
            s.sidebar,
            { backgroundColor: card, borderRightColor: border },
          ]}
        >
          <View style={[s.sideHeader, { borderBottomColor: border }]}>
            <View style={[s.sideIconWrap, { backgroundColor: PRIMARY + "15" }]}>
              <Feather name="gift" size={32} color={PRIMARY} />
            </View>
            <Text style={[s.sideTitle, { color: text }]}>Gift Cards</Text>
            <Text style={[s.sideSub, { color: sub }]}>
              Regala experiencias gastronómicas
            </Text>
            <View style={[s.countBadge, { backgroundColor: cardBg }]}>
              <Text style={[s.countText, { color: text }]}>
                {myCards.length} tarjeta{myCards.length !== 1 ? "s" : ""}
              </Text>
            </View>
          </View>
          <View style={s.sideNav}>
            {TABS.map((tab) => (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id as any)}
                style={[s.navItem, activeTab === tab.id && s.navItemActive]}
              >
                <Feather
                  name={tab.icon as any}
                  size={18}
                  color={activeTab === tab.id ? PRIMARY : sub}
                />
                <Text
                  style={[
                    s.navItemText,
                    { color: activeTab === tab.id ? PRIMARY : text },
                  ]}
                >
                  {tab.label}
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

        <ScrollView
          style={s.main}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === "buy" ? (
            <>
              {/* Info flujo */}
              <View
                style={[
                  s.infoBanner,
                  { backgroundColor: "#3B82F615", borderColor: "#3B82F630" },
                ]}
              >
                <Feather name="info" size={16} color="#3B82F6" />
                <Text style={[s.infoText, { color: "#3B82F6" }]}>
                  Tras crear la gift card, sube el comprobante de pago. El admin
                  la activará en breve.
                </Text>
              </View>

              {/* Monto */}
              <View
                style={[s.card, { backgroundColor: card, borderColor: border }]}
              >
                <View style={s.cardHeader}>
                  <Feather name="dollar-sign" size={18} color={PRIMARY} />
                  <Text style={[s.cardTitle, { color: text }]}>Monto</Text>
                </View>
                <View style={s.presetsRow}>
                  {PRESETS.map((p) => (
                    <Pressable
                      key={p}
                      onPress={() => setAmount(p.toString())}
                      style={[
                        s.presetBtn,
                        {
                          backgroundColor:
                            amount === p.toString() ? PRIMARY : cardBg,
                          borderColor:
                            amount === p.toString() ? PRIMARY : border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.presetBtnText,
                          { color: amount === p.toString() ? "#fff" : text },
                        ]}
                      >
                        {p} €
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="Monto personalizado (mín. €10)"
                  placeholderTextColor={sub}
                  keyboardType="numeric"
                  style={[
                    s.input,
                    {
                      backgroundColor: cardBg,
                      color: text,
                      borderColor: border,
                    },
                  ]}
                />
              </View>

              {/* Destinatario */}
              <View
                style={[s.card, { backgroundColor: card, borderColor: border }]}
              >
                <View style={s.cardHeader}>
                  <Feather name="user" size={18} color={PRIMARY} />
                  <Text style={[s.cardTitle, { color: text }]}>
                    Para (opcional)
                  </Text>
                </View>
                <TextInput
                  value={recipientEmail}
                  onChangeText={setRecipientEmail}
                  placeholder="Email del destinatario"
                  placeholderTextColor={sub}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={[
                    s.input,
                    {
                      backgroundColor: cardBg,
                      color: text,
                      borderColor: border,
                    },
                  ]}
                />
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Mensaje personalizado"
                  placeholderTextColor={sub}
                  multiline
                  numberOfLines={3}
                  style={[
                    s.textarea,
                    {
                      backgroundColor: cardBg,
                      color: text,
                      borderColor: border,
                      marginTop: 10,
                    },
                  ]}
                />
              </View>

              {/* Diseños */}
              {designs.length > 0 && (
                <View
                  style={[
                    s.card,
                    { backgroundColor: card, borderColor: border },
                  ]}
                >
                  <View style={s.cardHeader}>
                    <Feather name="image" size={18} color={PRIMARY} />
                    <Text style={[s.cardTitle, { color: text }]}>Diseño</Text>
                  </View>
                  <View style={s.designsRow}>
                    {designs.map((d: any) => (
                      <Pressable
                        key={d.id}
                        onPress={() => setSelectedDesign(d.name)}
                        style={[
                          s.designCard,
                          {
                            borderColor:
                              selectedDesign === d.name ? PRIMARY : border,
                            borderWidth: selectedDesign === d.name ? 3 : 1,
                          },
                        ]}
                      >
                        <Image
                          source={{ uri: d.imageUrl }}
                          style={s.designImg}
                          contentFit="cover"
                        />
                        <Text style={[s.designName, { color: sub }]}>
                          {d.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {/* Método de pago */}
              <View
                style={[s.card, { backgroundColor: card, borderColor: border }]}
              >
                <View style={s.cardHeader}>
                  <Feather name="credit-card" size={18} color={PRIMARY} />
                  <Text style={[s.cardTitle, { color: text }]}>
                    Método de pago
                  </Text>
                </View>
                <View style={{ gap: 8 }}>
                  {[
                    {
                      id: "stripe",
                      label: "Tarjeta / Bizum (Stripe)",
                      icon: "zap",
                      desc: "Pago instantáneo — gift card activa al momento",
                    },
                    {
                      id: "bizum_manual",
                      label: "Bizum manual",
                      icon: "smartphone",
                      desc: "Transfieres tú — admin activa en breve",
                    },
                    {
                      id: "sepa",
                      label: "Transferencia SEPA",
                      icon: "send",
                      desc: "Transfieres tú — admin activa en breve",
                    },
                  ].map((m) => (
                    <Pressable
                      key={m.id}
                      onPress={() => setPaymentMethod(m.id as any)}
                      style={[
                        s.methodRow,
                        {
                          borderColor:
                            paymentMethod === m.id ? PRIMARY : border,
                          backgroundColor:
                            paymentMethod === m.id ? PRIMARY + "08" : cardBg,
                        },
                      ]}
                    >
                      <View
                        style={[
                          s.methodIcon,
                          {
                            backgroundColor:
                              paymentMethod === m.id
                                ? PRIMARY + "15"
                                : border + "40",
                          },
                        ]}
                      >
                        <Feather
                          name={m.icon as any}
                          size={16}
                          color={paymentMethod === m.id ? PRIMARY : sub}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.methodLabel, { color: text }]}>
                          {m.label}
                        </Text>
                        <Text style={[s.methodDesc, { color: sub }]}>
                          {m.desc}
                        </Text>
                      </View>
                      {paymentMethod === m.id && (
                        <Feather
                          name="check-circle"
                          size={18}
                          color={PRIMARY}
                        />
                      )}
                    </Pressable>
                  ))}
                </View>
              </View>

              <Pressable
                onPress={() => purchaseMutation.mutate()}
                disabled={!canBuy}
                style={[
                  s.ctaBtn,
                  { backgroundColor: PRIMARY, opacity: canBuy ? 1 : 0.5 },
                ]}
              >
                {purchaseMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Feather name="gift" size={18} color="#fff" />
                    <Text style={s.ctaBtnText}>
                      {paymentMethod === "stripe"
                        ? `Pagar con Stripe ${amount} €`
                        : `Crear Gift Card ${amount} €`}
                    </Text>
                  </>
                )}
              </Pressable>
            </>
          ) : (
            <>
              <Text style={[s.sectionTitle, { color: text }]}>
                Mis Tarjetas ({myCards.length})
              </Text>

              {myCards.length === 0 ? (
                <View
                  style={[
                    s.empty,
                    { backgroundColor: card, borderColor: border },
                  ]}
                >
                  <Feather name="gift" size={44} color={sub} />
                  <Text style={[s.emptyTitle, { color: text }]}>
                    No tienes gift cards aún
                  </Text>
                  <Pressable
                    onPress={() => setActiveTab("buy")}
                    style={[
                      s.ctaBtn,
                      { backgroundColor: PRIMARY, marginTop: 8 },
                    ]}
                  >
                    <Text style={s.ctaBtnText}>Comprar una</Text>
                  </Pressable>
                </View>
              ) : (
                myCards.map((c: any) => {
                  const st = STATUS_LABELS[c.status] || STATUS_LABELS["active"];
                  const days = daysUntil(c.expiresAt);
                  const needsProof = c.status === "pending_payment";
                  const isProofOpen = proofCardId === c.id;

                  return (
                    <View
                      key={c.id}
                      style={[
                        s.giftCardItem,
                        {
                          backgroundColor: card,
                          borderColor: needsProof ? "#F59E0B" : border,
                        },
                      ]}
                    >
                      <View style={s.gcRow}>
                        <View
                          style={[
                            s.giftCardIcon,
                            { backgroundColor: st.color + "15" },
                          ]}
                        >
                          <Feather
                            name={st.icon as any}
                            size={22}
                            color={st.color}
                          />
                        </View>
                        <View style={{ flex: 1, marginLeft: 14 }}>
                          <Text style={[s.giftCardCode, { color: text }]}>
                            {c.code}
                          </Text>
                          <View
                            style={[
                              s.statusBadge,
                              { backgroundColor: st.color + "20" },
                            ]}
                          >
                            <Text style={[s.statusText, { color: st.color }]}>
                              {st.label}
                            </Text>
                          </View>
                          {c.status === "active" && (
                            <Text style={[s.giftCardBalance, { color: sub }]}>
                              Saldo: {c.balance?.toFixed(2)} €
                              {days !== null ? `  ·  Caduca en ${days}d` : ""}
                            </Text>
                          )}
                        </View>
                        <View style={{ alignItems: "flex-end", gap: 6 }}>
                          <Text style={[s.giftCardAmount, { color: PRIMARY }]}>
                            {c.amount?.toFixed(2)} €
                          </Text>
                          {c.status === "active" && (
                            <Pressable
                              onPress={() => {
                                navigator.clipboard
                                  ?.writeText(c.code)
                                  .catch(() => {});
                                showToast("Código copiado", "success");
                              }}
                              style={[s.copyBtn, { backgroundColor: cardBg }]}
                            >
                              <Feather name="copy" size={15} color={sub} />
                            </Pressable>
                          )}
                        </View>
                      </View>

                      {/* Formulario de comprobante */}
                      {needsProof && (
                        <View
                          style={[s.proofSection, { borderTopColor: border }]}
                        >
                          <Pressable
                            onPress={() =>
                              setProofCardId(isProofOpen ? null : c.id)
                            }
                            style={[
                              s.proofToggle,
                              { backgroundColor: "#F59E0B15" },
                            ]}
                          >
                            <Feather name="upload" size={15} color="#F59E0B" />
                            <Text
                              style={[s.proofToggleText, { color: "#F59E0B" }]}
                            >
                              {isProofOpen
                                ? "Cancelar"
                                : "Subir comprobante de pago"}
                            </Text>
                          </Pressable>

                          {isProofOpen && (
                            <View style={{ marginTop: 12, gap: 10 }}>
                              <Text style={[s.proofLabel, { color: sub }]}>
                                Método de pago
                              </Text>
                              <View style={s.providersRow}>
                                {PROVIDERS.map((p) => (
                                  <Pressable
                                    key={p}
                                    onPress={() => setProofProvider(p)}
                                    style={[
                                      s.providerBtn,
                                      {
                                        backgroundColor:
                                          proofProvider === p
                                            ? PRIMARY
                                            : cardBg,
                                        borderColor:
                                          proofProvider === p
                                            ? PRIMARY
                                            : border,
                                      },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        s.providerBtnText,
                                        {
                                          color:
                                            proofProvider === p ? "#fff" : text,
                                        },
                                      ]}
                                    >
                                      {p}
                                    </Text>
                                  </Pressable>
                                ))}
                              </View>
                              <TextInput
                                value={proofRef}
                                onChangeText={setProofRef}
                                placeholder="Referencia / número de operación"
                                placeholderTextColor={sub}
                                style={[
                                  s.input,
                                  {
                                    backgroundColor: cardBg,
                                    color: text,
                                    borderColor: border,
                                  },
                                ]}
                              />
                              <Pressable
                                onPress={handlePickProof}
                                disabled={proofUploading}
                                style={[
                                  s.input,
                                  {
                                    backgroundColor: cardBg,
                                    borderColor: border,
                                    height: proofUrl ? 120 : 46,
                                    justifyContent: "center",
                                    alignItems: "center",
                                    flexDirection: "row",
                                    gap: 8,
                                    opacity: proofUploading ? 0.6 : 1,
                                  },
                                ]}
                              >
                                {proofUploading ? (
                                  <ActivityIndicator
                                    size="small"
                                    color={PRIMARY}
                                  />
                                ) : proofUrl ? (
                                  <img
                                    src={proofUrl}
                                    style={{
                                      width: "100%",
                                      height: 112,
                                      objectFit: "cover",
                                      borderRadius: 8,
                                    }}
                                  />
                                ) : (
                                  <>
                                    <Feather
                                      name="image"
                                      size={18}
                                      color={sub}
                                    />
                                    <Text style={{ color: sub, fontSize: 14 }}>
                                      Seleccionar imagen del comprobante
                                    </Text>
                                  </>
                                )}
                              </Pressable>
                              <Pressable
                                onPress={() => proofMutation.mutate(c.id)}
                                disabled={!canProof}
                                style={[
                                  s.ctaBtn,
                                  {
                                    backgroundColor: "#F59E0B",
                                    opacity: canProof ? 1 : 0.5,
                                  },
                                ]}
                              >
                                {proofMutation.isPending ? (
                                  <ActivityIndicator color="#fff" />
                                ) : (
                                  <>
                                    <Feather
                                      name="send"
                                      size={16}
                                      color="#fff"
                                    />
                                    <Text style={s.ctaBtnText}>
                                      Enviar comprobante
                                    </Text>
                                  </>
                                )}
                              </Pressable>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </>
          )}
        </ScrollView>
      </View>
    </WebLayout>
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
  countBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  countText: { fontSize: 12, fontWeight: "600" },
  sideNav: { flex: 1, paddingVertical: 16 },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  navItemActive: {
    backgroundColor: "#DC262610",
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
  content: { padding: 32, maxWidth: 720, paddingBottom: 80 },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18 },
  card: { borderRadius: 14, borderWidth: 1, padding: 20, marginBottom: 16 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  presetsRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  presetBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
  },
  presetBtnText: { fontSize: 16, fontWeight: "700" },
  input: {
    height: 46,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  textarea: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: "top" as any,
  },
  designsRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  designCard: {
    width: 110,
    borderRadius: 10,
    overflow: "hidden" as any,
    alignItems: "center",
  },
  designImg: { width: 110, height: 110, borderRadius: 10 },
  designName: { fontSize: 11, marginTop: 4, textAlign: "center" },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 12,
  },
  ctaBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  methodIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  methodLabel: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  methodDesc: { fontSize: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  empty: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 48,
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: "600" },
  giftCardItem: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 12,
  },
  gcRow: { flexDirection: "row", alignItems: "center" },
  giftCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  giftCardCode: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 4,
  },
  statusText: { fontSize: 11, fontWeight: "700" },
  giftCardBalance: { fontSize: 12 },
  giftCardAmount: { fontSize: 18, fontWeight: "800" },
  copyBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  proofSection: { marginTop: 14, paddingTop: 14, borderTopWidth: 1 },
  proofToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  proofToggleText: { fontSize: 13, fontWeight: "700" },
  proofLabel: { fontSize: 12, fontWeight: "600" },
  providersRow: { flexDirection: "row", gap: 8 },
  providerBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  providerBtnText: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "capitalize" as any,
  },
});
