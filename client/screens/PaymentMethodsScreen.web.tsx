import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Text,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { apiRequest } from "@/lib/query-client";
import { MobileSidebarWrapper } from "@/components/MobileSidebarWrapper";
import { WebLayout } from "@/components/WebLayout";

const PRIMARY = "#DC2626";

export default function PaymentMethodsScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const cardBg = isDark ? "#2a2a2a" : "#f9fafb";

  const isDriver = user?.role === "delivery_driver";
  const [cards, setCards] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"cards" | "history">("cards");

  useEffect(() => {
    if (isDriver) {
      setLoading(false);
      return;
    }
    Promise.all([
      apiRequest("GET", "/api/stripe/cards").then((r) => r.json()),
      apiRequest("GET", "/api/stripe/history").then((r) => r.json()),
    ])
      .then(([c, h]) => {
        setCards(c.cards || []);
        setHistory(h.payments || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isDriver]);

  const handleSetDefault = async (id: string) => {
    await apiRequest("PUT", `/api/stripe/cards/${id}/default`);
    showToast("Tarjeta predeterminada actualizada", "success");
    const r = await apiRequest("GET", "/api/stripe/cards").then((r) =>
      r.json(),
    );
    setCards(r.cards || []);
  };

  const handleDelete = async (id: string) => {
    await apiRequest("DELETE", `/api/stripe/cards/${id}`);
    showToast("Tarjeta eliminada", "success");
    setCards(cards.filter((c) => c.id !== id));
  };

  const TABS = [
    { id: "cards", label: "Tarjetas", icon: "credit-card" },
    { id: "history", label: "Historial", icon: "clock" },
  ];

  return (
    <WebLayout>
      <View style={[s.root, { backgroundColor: bg }]}>
        <MobileSidebarWrapper
          title="Métodos de Pago"
          sidebarStyle={[
            s.sidebar,
            { backgroundColor: card, borderRightColor: border },
          ]}
        >
          <View style={[s.sideHeader, { borderBottomColor: border }]}>
            <View style={[s.sideIconWrap, { backgroundColor: PRIMARY + "15" }]}>
              <Feather name="credit-card" size={32} color={PRIMARY} />
            </View>
            <Text style={[s.sideTitle, { color: text }]}>
              {isDriver ? "Método de Pago" : "Métodos de Pago"}
            </Text>
            <Text style={[s.sideSub, { color: sub }]}>
              {isDriver
                ? "Configuración de pagos Stripe"
                : `${cards.length} tarjeta${cards.length !== 1 ? "s" : ""} guardada${cards.length !== 1 ? "s" : ""}`}
            </Text>
          </View>
          {!isDriver && (
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
          )}
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
          {loading ? (
            <View style={s.loadingWrap}>
              <ActivityIndicator size="large" color={PRIMARY} />
            </View>
          ) : isDriver ? (
            <>
              <View
                style={[
                  s.infoBanner,
                  {
                    backgroundColor: PRIMARY + "10",
                    borderColor: PRIMARY + "30",
                  },
                ]}
              >
                <Feather name="info" size={18} color={PRIMARY} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[s.bannerTitle, { color: PRIMARY }]}>
                    ¿Cómo funcionan los pagos?
                  </Text>
                  <Text style={[s.bannerSub, { color: PRIMARY }]}>
                    Cuando confirmes una entrega, tu pago se libera
                    automáticamente y Stripe lo transfiere a tu cuenta bancaria
                    en 1-2 días hábiles.
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <>
              {/* Aviso web */}
              <View
                style={[
                  s.warnBanner,
                  { backgroundColor: "#F59E0B15", borderColor: "#F59E0B30" },
                ]}
              >
                <Feather name="info" size={16} color="#F59E0B" />
                <Text style={[s.warnText, { color: "#92400E" }]}>
                  Para agregar tarjetas usa la app móvil. Aquí puedes ver tus
                  tarjetas e historial.
                </Text>
              </View>

              {activeTab === "cards" ? (
                cards.length === 0 ? (
                  <View
                    style={[
                      s.empty,
                      { backgroundColor: card, borderColor: border },
                    ]}
                  >
                    <Feather name="credit-card" size={44} color={sub} />
                    <Text style={[s.emptyTitle, { color: text }]}>
                      No tienes tarjetas guardadas
                    </Text>
                    <Text style={[s.emptySub, { color: sub }]}>
                      Agrega una tarjeta durante el checkout para pagos más
                      rápidos
                    </Text>
                  </View>
                ) : (
                  cards.map((c) => (
                    <View
                      key={c.id}
                      style={[
                        s.cardItem,
                        { backgroundColor: card, borderColor: border },
                      ]}
                    >
                      <View
                        style={[
                          s.cardIconWrap,
                          { backgroundColor: PRIMARY + "15" },
                        ]}
                      >
                        <Feather name="credit-card" size={22} color={PRIMARY} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 14 }}>
                        <Text style={[s.cardBrand, { color: text }]}>
                          {c.brand} •••• {c.last4}
                        </Text>
                        <Text style={[s.cardExp, { color: sub }]}>
                          Vence {c.expMonth}/{c.expYear}
                        </Text>
                      </View>
                      {c.isDefault && (
                        <View
                          style={[
                            s.defaultBadge,
                            { backgroundColor: "#10B98120" },
                          ]}
                        >
                          <Text
                            style={{
                              color: "#10B981",
                              fontSize: 12,
                              fontWeight: "600",
                            }}
                          >
                            Predeterminada
                          </Text>
                        </View>
                      )}
                      <View style={s.cardActions}>
                        {!c.isDefault && (
                          <Pressable
                            onPress={() => handleSetDefault(c.id)}
                            style={[s.actionBtn, { backgroundColor: cardBg }]}
                          >
                            <Feather name="check" size={14} color={PRIMARY} />
                            <Text
                              style={{
                                color: PRIMARY,
                                fontSize: 12,
                                fontWeight: "600",
                                marginLeft: 4,
                              }}
                            >
                              Predeterminar
                            </Text>
                          </Pressable>
                        )}
                        <Pressable
                          onPress={() => handleDelete(c.id)}
                          style={[
                            s.actionBtn,
                            { backgroundColor: "#EF444415" },
                          ]}
                        >
                          <Feather name="trash-2" size={14} color="#EF4444" />
                          <Text
                            style={{
                              color: "#EF4444",
                              fontSize: 12,
                              fontWeight: "600",
                              marginLeft: 4,
                            }}
                          >
                            Eliminar
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ))
                )
              ) : history.length === 0 ? (
                <View
                  style={[
                    s.empty,
                    { backgroundColor: card, borderColor: border },
                  ]}
                >
                  <Feather name="clock" size={44} color={sub} />
                  <Text style={[s.emptyTitle, { color: text }]}>
                    Sin historial de pagos
                  </Text>
                </View>
              ) : (
                history.slice(0, 20).map((item: any) => (
                  <View
                    key={item.payment.id}
                    style={[
                      s.historyItem,
                      { backgroundColor: card, borderColor: border },
                    ]}
                  >
                    <View style={[s.histIconWrap, { backgroundColor: cardBg }]}>
                      <Feather
                        name={
                          item.payment.method === "card"
                            ? "credit-card"
                            : "dollar-sign"
                        }
                        size={18}
                        color={sub}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[s.histAmount, { color: text }]}>
                        {((item.payment.amount || 0) / 100).toFixed(2)} €
                      </Text>
                      <Text style={[s.histDate, { color: sub }]}>
                        {new Date(item.payment.createdAt).toLocaleDateString(
                          "es-ES",
                          { day: "numeric", month: "short", year: "numeric" },
                        )}
                      </Text>
                    </View>
                    <View
                      style={[
                        s.statusPill,
                        {
                          backgroundColor:
                            item.payment.status === "completed"
                              ? "#10B98120"
                              : "#F59E0B20",
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color:
                            item.payment.status === "completed"
                              ? "#10B981"
                              : "#F59E0B",
                          fontSize: 12,
                          fontWeight: "600",
                        }}
                      >
                        {item.payment.status === "completed"
                          ? "Completado"
                          : "Pendiente"}
                      </Text>
                    </View>
                  </View>
                ))
              )}

              <View
                style={[
                  s.infoBanner,
                  {
                    backgroundColor: PRIMARY + "10",
                    borderColor: PRIMARY + "30",
                    marginTop: 16,
                  },
                ]}
              >
                <Feather name="shield" size={18} color={PRIMARY} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[s.bannerTitle, { color: PRIMARY }]}>
                    Pagos seguros con Stripe
                  </Text>
                  <Text style={[s.bannerSub, { color: PRIMARY }]}>
                    Tus datos están protegidos con encriptación de nivel
                    bancario.
                  </Text>
                </View>
              </View>
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
  sideSub: { fontSize: 12, textAlign: "center" },
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
  loadingWrap: { alignItems: "center", paddingTop: 60 },
  warnBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  warnText: { flex: 1, fontSize: 13 },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  bannerTitle: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  bannerSub: { fontSize: 13, lineHeight: 18 },
  empty: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 48,
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: { fontSize: 17, fontWeight: "700" },
  emptySub: { fontSize: 14, textAlign: "center" },
  cardItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  cardBrand: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  cardExp: { fontSize: 13 },
  defaultBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  cardActions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  histIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  histAmount: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  histDate: { fontSize: 13 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
});
