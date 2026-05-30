import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Switch,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";

const GREEN = "#16A34A";
const AMBER = "#F59E0B";
const BLUE = "#3B82F6";
const PURPLE = "#8B5CF6";

interface Order {
  id: string;
  businessName: string;
  businessAddress: string;
  deliveryAddress: string;
  items: any[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
  distanceKm?: number;
  estimatedMinutes?: number;
  createdAt: string;
}

interface Props {
  isOnline: boolean;
  onToggleOnline: () => void;
  togglingOnline: boolean;
  showToast?: (msg: string, type?: string) => void;
}

export function AvailableOrdersTab({
  isOnline,
  onToggleOnline,
  togglingOnline,
  showToast,
}: Props) {
  const { isDark } = useTheme();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const intervalRef = useRef<any>(null);

  const bg = isDark ? "#0d0d0d" : "#f2f3f5";
  const card = isDark ? "#1a1a1a" : "#fff";
  const border = isDark ? "#2a2a2a" : "#ebebeb";
  const text = isDark ? "#fff" : "#111";
  const sub = isDark ? "#666" : "#aaa";
  const chipBg = isDark ? "#222" : "#f0f0f0";

  const flash = (ok: boolean, t: string) => {
    setMsg({ ok, text: t });
    setTimeout(() => setMsg(null), 3500);
  };

  const load = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/delivery/available-orders");
      const data = await res.json();
      if (data.success) setOrders(data.orders ?? []);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 8000);
    return () => clearInterval(intervalRef.current);
  }, [load]);

  const handleAccept = async (orderId: string) => {
    if (!isOnline) {
      flash(false, "Debes estar en línea para aceptar pedidos");
      return;
    }
    setAccepting(orderId);
    try {
      const res = await apiRequest(
        "POST",
        `/api/delivery/accept/${orderId}`,
        {},
      );
      const data = await res.json();
      if (data.success) {
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
        flash(true, "Pedido aceptado — ve a la pestaña Mis Entregas");
      } else {
        flash(false, data.error ?? "No se pudo aceptar el pedido");
      }
    } catch {
      flash(false, "Error al aceptar el pedido");
    } finally {
      setAccepting(null);
    }
  };

  const parseItems = (raw: any): any[] => {
    if (Array.isArray(raw)) return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  };

  const fmtEur = (cents: number) => `€${(cents / 100).toFixed(2)}`;
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });

  // ── KPI bar ──────────────────────────────────────────────────────────────
  const totalEarnings = orders.reduce((s, o) => s + (o.deliveryFee ?? 0), 0);
  const avgDist = orders.length
    ? (
        orders.reduce((s, o) => s + (o.distanceKm ?? 0), 0) / orders.length
      ).toFixed(1)
    : "—";

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      {/* ── Header ── */}
      <View
        style={[s.header, { backgroundColor: card, borderBottomColor: border }]}
      >
        <View style={s.headerLeft}>
          <Text style={[s.title, { color: text }]}>Pedidos disponibles</Text>
          <Text style={[s.subtitle, { color: sub }]}>
            Actualización automática cada 8s
          </Text>
        </View>

        {/* Online toggle */}
        <View
          style={[
            s.toggleWrap,
            {
              backgroundColor: isOnline ? GREEN + "12" : chipBg,
              borderColor: isOnline ? GREEN + "40" : border,
            },
          ]}
        >
          <View
            style={[s.pulse, { backgroundColor: isOnline ? GREEN : "#9ca3af" }]}
          />
          <Text style={[s.toggleTxt, { color: isOnline ? GREEN : sub }]}>
            {togglingOnline
              ? "Cambiando..."
              : isOnline
                ? "En línea"
                : "Desconectado"}
          </Text>
          <Switch
            value={isOnline}
            onValueChange={onToggleOnline}
            disabled={togglingOnline}
            trackColor={{ false: "#d1d5db", true: GREEN + "80" }}
            thumbColor={isOnline ? GREEN : "#9ca3af"}
          />
        </View>
      </View>

      {/* ── KPI strip ── */}
      <View
        style={[
          s.kpiStrip,
          { backgroundColor: card, borderBottomColor: border },
        ]}
      >
        {[
          {
            label: "Disponibles",
            value: orders.length,
            color: BLUE,
            icon: "package",
          },
          {
            label: "Ganancia total",
            value: fmtEur(totalEarnings),
            color: GREEN,
            icon: "trending-up",
          },
          {
            label: "Dist. media",
            value: `${avgDist} km`,
            color: PURPLE,
            icon: "map-pin",
          },
          {
            label: "Estado",
            value: isOnline ? "Activo" : "Inactivo",
            color: isOnline ? GREEN : "#9ca3af",
            icon: "radio",
          },
        ].map((k) => (
          <View key={k.label} style={s.kpiItem}>
            <View style={[s.kpiIcon, { backgroundColor: k.color + "15" }]}>
              <Feather name={k.icon as any} size={14} color={k.color} />
            </View>
            <Text style={[s.kpiVal, { color: k.color }]}>{k.value}</Text>
            <Text style={[s.kpiLbl, { color: sub }]}>{k.label}</Text>
          </View>
        ))}
      </View>

      {/* ── Feedback ── */}
      {msg && (
        <View
          style={[
            s.msgBar,
            { backgroundColor: msg.ok ? "#16A34A15" : "#EF444415" },
          ]}
        >
          <Feather
            name={msg.ok ? "check-circle" : "alert-circle"}
            size={14}
            color={msg.ok ? GREEN : "#EF4444"}
          />
          <Text style={[s.msgTxt, { color: msg.ok ? GREEN : "#EF4444" }]}>
            {msg.text}
          </Text>
        </View>
      )}

      {/* ── Offline banner ── */}
      {!isOnline && (
        <View
          style={[
            s.offlineBanner,
            { backgroundColor: AMBER + "15", borderColor: AMBER + "40" },
          ]}
        >
          <Feather name="alert-triangle" size={16} color={AMBER} />
          <Text style={[s.offlineTxt, { color: AMBER }]}>
            Estás desconectado. Activa el toggle para recibir y aceptar pedidos.
          </Text>
        </View>
      )}

      {/* ── List ── */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={GREEN} />
          <Text style={[s.loadingTxt, { color: sub }]}>
            Buscando pedidos...
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={GREEN}
            />
          }
        >
          {orders.length === 0 ? (
            <View style={s.empty}>
              <View style={[s.emptyIcon, { backgroundColor: chipBg }]}>
                <Feather name="inbox" size={36} color={sub} />
              </View>
              <Text style={[s.emptyTitle, { color: text }]}>
                Sin pedidos disponibles
              </Text>
              <Text style={[s.emptySub, { color: sub }]}>
                {isOnline
                  ? "Los pedidos listos para recoger aparecerán aquí automáticamente."
                  : "Activa tu estado para empezar a recibir pedidos."}
              </Text>
            </View>
          ) : (
            orders.map((order) => {
              const items = parseItems(order.items);
              const isAccepting = accepting === order.id;
              const distKm = order.distanceKm
                ? (order.distanceKm / 1000).toFixed(1)
                : null;
              const eta =
                order.estimatedMinutes ??
                (distKm ? Math.round(parseFloat(distKm) * 3) : null);

              return (
                <View
                  key={order.id}
                  style={[
                    s.card,
                    { backgroundColor: card, borderColor: border },
                  ]}
                >
                  {/* Card header */}
                  <View style={s.cardHeader}>
                    <View
                      style={[
                        s.businessBadge,
                        { backgroundColor: BLUE + "15" },
                      ]}
                    >
                      <Feather name="shopping-bag" size={14} color={BLUE} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[s.businessName, { color: text }]}>
                        {order.businessName}
                      </Text>
                      <Text style={[s.orderId, { color: sub }]}>
                        #{order.id.slice(0, 8).toUpperCase()} ·{" "}
                        {fmtTime(order.createdAt)}
                      </Text>
                    </View>
                    <View
                      style={[s.newBadge, { backgroundColor: GREEN + "20" }]}
                    >
                      <Text style={[s.newBadgeTxt, { color: GREEN }]}>
                        NUEVO
                      </Text>
                    </View>
                  </View>

                  {/* Route */}
                  <View
                    style={[
                      s.routeBox,
                      {
                        backgroundColor: isDark ? "#222" : "#f8f9fa",
                        borderColor: border,
                      },
                    ]}
                  >
                    <View style={s.routeRow}>
                      <View style={[s.routeDot, { backgroundColor: AMBER }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.routeLabel, { color: sub }]}>
                          RECOGIDA
                        </Text>
                        <Text
                          style={[s.routeAddr, { color: text }]}
                          numberOfLines={1}
                        >
                          {order.businessAddress || order.businessName}
                        </Text>
                      </View>
                    </View>
                    <View style={[s.routeLine, { backgroundColor: border }]} />
                    <View style={s.routeRow}>
                      <View style={[s.routeDot, { backgroundColor: PURPLE }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.routeLabel, { color: sub }]}>
                          ENTREGA
                        </Text>
                        <Text
                          style={[s.routeAddr, { color: text }]}
                          numberOfLines={1}
                        >
                          {order.deliveryAddress}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Chips */}
                  <View style={s.chips}>
                    {distKm && (
                      <View style={[s.chip, { backgroundColor: chipBg }]}>
                        <Feather name="map-pin" size={11} color={sub} />
                        <Text style={[s.chipTxt, { color: sub }]}>
                          {distKm} km
                        </Text>
                      </View>
                    )}
                    {eta && (
                      <View style={[s.chip, { backgroundColor: chipBg }]}>
                        <Feather name="clock" size={11} color={sub} />
                        <Text style={[s.chipTxt, { color: sub }]}>
                          ~{eta} min
                        </Text>
                      </View>
                    )}
                    <View style={[s.chip, { backgroundColor: chipBg }]}>
                      <Feather name="package" size={11} color={sub} />
                      <Text style={[s.chipTxt, { color: sub }]}>
                        {items.length} prod.
                      </Text>
                    </View>
                    <View style={[s.chip, { backgroundColor: chipBg }]}>
                      <Feather
                        name={
                          order.paymentMethod === "cash"
                            ? "dollar-sign"
                            : "credit-card"
                        }
                        size={11}
                        color={sub}
                      />
                      <Text style={[s.chipTxt, { color: sub }]}>
                        {order.paymentMethod === "cash"
                          ? "Efectivo"
                          : "Digital"}
                      </Text>
                    </View>
                  </View>

                  {/* Items preview */}
                  {items.length > 0 && (
                    <View style={[s.itemsPreview, { borderTopColor: border }]}>
                      <Text style={[s.itemsTitle, { color: sub }]}>
                        PRODUCTOS
                      </Text>
                      {items.slice(0, 3).map((it: any, i: number) => (
                        <Text
                          key={i}
                          style={[s.itemRow, { color: text }]}
                          numberOfLines={1}
                        >
                          <Text style={{ color: sub }}>
                            {it.quantity ?? 1}×{" "}
                          </Text>
                          {it.name ?? it.productName ?? "Producto"}
                        </Text>
                      ))}
                      {items.length > 3 && (
                        <Text style={[s.itemMore, { color: sub }]}>
                          +{items.length - 3} más
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Footer */}
                  <View style={[s.cardFooter, { borderTopColor: border }]}>
                    <View>
                      <Text style={[s.earningLabel, { color: sub }]}>
                        Tu ganancia
                      </Text>
                      <Text style={[s.earningVal, { color: GREEN }]}>
                        {fmtEur(order.deliveryFee ?? 0)}
                      </Text>
                    </View>
                    <View style={s.footerRight}>
                      <View style={s.totalWrap}>
                        <Text style={[s.totalLabel, { color: sub }]}>
                          Total pedido
                        </Text>
                        <Text style={[s.totalVal, { color: text }]}>
                          {fmtEur(order.total ?? 0)}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleAccept(order.id)}
                        disabled={!!accepting || !isOnline}
                        style={[
                          s.acceptBtn,
                          {
                            backgroundColor: isOnline ? GREEN : "#9ca3af",
                            opacity: isAccepting ? 0.7 : 1,
                          },
                        ]}
                      >
                        {isAccepting ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Feather name="check" size={16} color="#fff" />
                        )}
                        <Text style={s.acceptTxt}>
                          {isAccepting ? "Aceptando..." : "Aceptar pedido"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerLeft: { flex: 1 },
  title: { fontSize: 20, fontWeight: "800" },
  subtitle: { fontSize: 12, marginTop: 2 },
  toggleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
  },
  pulse: { width: 8, height: 8, borderRadius: 4 },
  toggleTxt: { fontSize: 13, fontWeight: "700" },
  kpiStrip: { flexDirection: "row", borderBottomWidth: 1 },
  kpiItem: { flex: 1, alignItems: "center", paddingVertical: 14, gap: 4 },
  kpiIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
  kpiVal: { fontSize: 16, fontWeight: "800" },
  kpiLbl: { fontSize: 10, fontWeight: "600" },
  msgBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  msgTxt: { fontSize: 13, fontWeight: "600" },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  offlineTxt: { flex: 1, fontSize: 13, fontWeight: "600" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingTxt: { fontSize: 14 },
  listContent: { padding: 20, gap: 14, paddingBottom: 40 },
  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTitle: { fontSize: 17, fontWeight: "700" },
  emptySub: { fontSize: 13, textAlign: "center", maxWidth: 320 },
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingBottom: 12,
  },
  businessBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  businessName: { fontSize: 15, fontWeight: "700" },
  orderId: { fontSize: 11, marginTop: 2 },
  newBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  newBadgeTxt: { fontSize: 9, fontWeight: "800" },
  routeBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  routeRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 3,
    flexShrink: 0,
  },
  routeLine: { width: 2, height: 10, marginLeft: 4 },
  routeLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
  routeAddr: { fontSize: 13, fontWeight: "500", marginTop: 1 },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  chipTxt: { fontSize: 11, fontWeight: "600" },
  itemsPreview: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    gap: 3,
  },
  itemsTitle: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  itemRow: { fontSize: 12 },
  itemMore: { fontSize: 11, marginTop: 2 },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderTopWidth: 1,
  },
  earningLabel: { fontSize: 10, fontWeight: "600" },
  earningVal: { fontSize: 22, fontWeight: "900" },
  footerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  totalWrap: { alignItems: "flex-end" },
  totalLabel: { fontSize: 10 },
  totalVal: { fontSize: 14, fontWeight: "700" },
  acceptBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  acceptTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },
});
