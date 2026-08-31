import React, { useState, useEffect, useCallback, useRef } from "react";
import { displayOrderNumber } from "@/utils/orderNumber";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";

const GREEN = "#16A34A";
const AMBER = "#F59E0B";
const BLUE = "#3B82F6";
const PURPLE = "#8B5CF6";
const RED = "#EF4444";

const STATUS_META: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  ready: { label: "Listo para recoger", color: AMBER, icon: "clock" },
  picked_up: { label: "Recogido", color: BLUE, icon: "package" },
  preparing: { label: "Preparando", color: AMBER, icon: "loader" },
  on_the_way: { label: "En camino", color: PURPLE, icon: "navigation" },
  in_transit: { label: "En tránsito", color: PURPLE, icon: "navigation" },
  arriving: { label: "Llegando al cliente", color: RED, icon: "map-pin" },
  delivered: { label: "Esperando confirm.", color: BLUE, icon: "check-circle" },
  completed: { label: "Completado", color: GREEN, icon: "check-circle" },
  cancelled: { label: "Cancelado", color: RED, icon: "x-circle" },
};

// "arriving"/"in_transit" DEBEN estar: el pipeline los usa en el tramo final
// y sin ellos el pedido desaparecía de esta lista
const ACTIVE_STATUSES = [
  "ready",
  "picked_up",
  "preparing",
  "on_the_way",
  "in_transit",
  "arriving",
  "delivered",
];
const HISTORY_STATUSES = ["completed", "cancelled"];

interface Order {
  id: string;
  businessName: string;
  businessAddress?: string;
  deliveryAddress: string;
  deliveryLatitude?: string;
  deliveryLongitude?: string;
  items: any;
  subtotal: number;
  deliveryFee: number;
  deliveryEarnings?: number;
  total: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  deliveredAt?: string;
  confirmedByCustomer?: boolean;
  driverCancelReason?: string;
  pendingCashTip?: {
    amountCents: number;
    declaredBy: "customer" | "driver";
  } | null;
}

interface Props {
  mode: "active" | "history";
  showToast?: (msg: string, type?: string) => void;
  onNavigateToMap?: (orderId: string, lat: string, lng: string) => void;
}

export function MyDeliveriesTab({ mode, showToast, onNavigateToMap }: Props) {
  const { isDark } = useTheme();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Photo upload state (web: file input)
  const [photoOrder, setPhotoOrder] = useState<string | null>(null);
  const [photoB64, setPhotoB64] = useState<string | null>(null);
  // Cancelar pedido con motivo (libera antes de recoger / cancela después)
  const [cancelOrder, setCancelOrder] = useState<string | null>(null);
  const [cancelMode, setCancelMode] = useState<"released" | "cancelled">(
    "released",
  );
  const [cancelReason, setCancelReason] = useState<string | null>(null);
  const [cancelNote, setCancelNote] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const intervalRef = useRef<any>(null);

  const bg = isDark ? "#0d0d0d" : "#f2f3f5";
  const card = isDark ? "#1a1a1a" : "#fff";
  const border = isDark ? "#2a2a2a" : "#ebebeb";
  const text = isDark ? "#fff" : "#111";
  const sub = isDark ? "#666" : "#aaa";
  const chipBg = isDark ? "#222" : "#f0f0f0";
  const inputBg = isDark ? "#222" : "#f8f8f8";

  const flash = (ok: boolean, t: string) => {
    setMsg({ ok, text: t });
    setTimeout(() => setMsg(null), 3500);
  };

  const load = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/delivery/my-orders");
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
    if (mode === "active") {
      intervalRef.current = setInterval(load, 6000);
    }
    return () => clearInterval(intervalRef.current);
  }, [load, mode]);

  const updateStatus = async (orderId: string, status: string, extra?: any) => {
    setActionId(orderId);
    try {
      let endpoint = "";
      let method: "POST" | "PUT" = "POST";
      let body: any = {};
      if (status === "picked_up") {
        // Paso 1: recoger el pedido en el local → picked_up
        endpoint = `/api/orders/${orderId}/pickup`;
      } else if (status === "on_the_way") {
        // Paso 2: iniciar la entrega → on_the_way
        endpoint = `/api/delivery/orders/${orderId}/status`;
        method = "PUT";
        body = { status: "on_the_way" };
      } else if (status === "delivered") {
        endpoint = `/api/orders/${orderId}/complete-delivery`;
        body = {
          deliveryPhoto: extra?.photo ?? null,
          latitude: null,
          longitude: null,
          confirmWithoutGps: true,
        };
      } else {
        endpoint = `/api/delivery/orders/${orderId}/status`;
        body = { status };
      }
      const res = await apiRequest(method as any, endpoint, body);
      const data = await res.json();
      if (data.success || res.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status } : o)),
        );
        flash(
          true,
          status === "delivered"
            ? "¡Entrega confirmada! Esperando confirmación del cliente."
            : status === "picked_up"
              ? "Pedido recogido — inicia la entrega cuando salgas del local"
              : "Estado actualizado",
        );
      } else {
        flash(false, data.error ?? "Error al actualizar estado");
      }
    } catch {
      flash(false, "Error de conexión");
    } finally {
      setActionId(null);
      setPhotoOrder(null);
      setPhotoB64(null);
    }
  };

  const handleDeliverWithPhoto = async (orderId: string) => {
    if (!photoB64) {
      flash(false, "Selecciona una foto de entrega");
      return;
    }
    await updateStatus(orderId, "delivered", { photo: photoB64 });
  };

  const handleFileChange = (e: any) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoB64(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const openMaps = (lat: string, lng: string) => {
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      "_blank",
    );
  };

  const parseItems = (raw: any): any[] => {
    if (Array.isArray(raw)) return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  };

  const fmtEur = (cents: number) => `${(cents / 100).toFixed(2)} €`;
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  // Propina en efectivo: doble confirmación (el cliente la declara y el
  // repartidor confirma haberla recibido)
  const respondCashTip = async (orderId: string, approved: boolean) => {
    try {
      const res = await apiRequest(
        "POST",
        `/api/orders/${orderId}/cash-tip/respond`,
        { approved },
      );
      const data = await res.json();
      if (data.success) {
        flash(true, approved ? "Propina registrada 💝" : "Propina rechazada");
      } else {
        flash(false, data.error || "No se pudo procesar la propina");
      }
      load();
    } catch {
      flash(false, "Error de conexión");
    }
  };

  // Cancelar pedido aceptado: antes de recoger se libera a la bolsa;
  // después de recoger se cancela con reembolso al cliente
  const submitDriverCancel = async () => {
    if (!cancelOrder || !cancelReason) return;
    setCancelling(true);
    try {
      const res = await apiRequest(
        "POST",
        `/api/delivery/orders/${cancelOrder}/cancel`,
        { reason: cancelReason, note: cancelNote },
      );
      const data = await res.json();
      if (data.success) {
        flash(
          true,
          data.mode === "released"
            ? "Pedido liberado — disponible para otros repartidores"
            : "Pedido cancelado — se reembolsará al cliente",
        );
      } else {
        flash(false, data.error || data.message || "No se pudo cancelar");
      }
      setCancelOrder(null);
      setCancelReason(null);
      setCancelNote("");
      load();
    } catch {
      flash(false, "Error de conexión");
    } finally {
      setCancelling(false);
    }
  };

  const displayed = orders
    .filter((o) =>
      mode === "active"
        ? ACTIVE_STATUSES.includes(o.status) &&
          !(o.status === "delivered" && o.confirmedByCustomer)
        : HISTORY_STATUSES.includes(o.status) ||
            (o.status === "delivered" && o.confirmedByCustomer),
    )
    .filter(
      (o) =>
        !search.trim() ||
        o.businessName.toLowerCase().includes(search.toLowerCase()) ||
        o.id.includes(search),
    );

  // ── KPIs ──
  const activeCount = orders.filter((o) =>
    ACTIVE_STATUSES.includes(o.status),
  ).length;
  const completedCount = orders.filter((o) => o.status === "completed").length;
  const totalEarned = orders
    .filter((o) => o.status === "completed")
    .reduce((s, o) => s + (o.deliveryEarnings ?? o.deliveryFee ?? 0), 0);

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      {/* ── Header ── */}
      <View
        style={[s.header, { backgroundColor: card, borderBottomColor: border }]}
      >
        <View style={s.headerLeft}>
          <Text style={[s.title, { color: text }]}>
            {mode === "active" ? "Entregas activas" : "Historial de entregas"}
          </Text>
          <Text style={[s.subtitle, { color: sub }]}>
            {mode === "active"
              ? `${activeCount} en curso`
              : `${completedCount} completadas`}
          </Text>
        </View>
        <View
          style={[
            s.searchWrap,
            { backgroundColor: inputBg, borderColor: border },
          ]}
        >
          <Feather name="search" size={14} color={sub} />
          <TextInput
            style={[s.searchInput, { color: text }] as any}
            placeholder="Buscar pedido..."
            placeholderTextColor={sub}
            value={search}
            onChangeText={setSearch}
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
            label: "Activas",
            value: activeCount,
            color: BLUE,
            icon: "activity",
          },
          {
            label: "Completadas",
            value: completedCount,
            color: GREEN,
            icon: "check-circle",
          },
          {
            label: "Ganado hoy",
            value: fmtEur(totalEarned),
            color: AMBER,
            icon: "trending-up",
          },
          {
            label: "Mostrando",
            value: displayed.length,
            color: sub,
            icon: "list",
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
            color={msg.ok ? GREEN : RED}
          />
          <Text style={[s.msgTxt, { color: msg.ok ? GREEN : RED }]}>
            {msg.text}
          </Text>
        </View>
      )}

      {/* ── Hidden file input for photo ── */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* ── List ── */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={GREEN} />
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
          {displayed.length === 0 ? (
            <View style={s.empty}>
              <View style={[s.emptyIcon, { backgroundColor: chipBg }]}>
                <Feather
                  name={mode === "active" ? "truck" : "archive"}
                  size={36}
                  color={sub}
                />
              </View>
              <Text style={[s.emptyTitle, { color: text }]}>
                {mode === "active" ? "Sin entregas activas" : "Sin historial"}
              </Text>
              <Text style={[s.emptySub, { color: sub }]}>
                {mode === "active"
                  ? "Acepta pedidos disponibles para verlos aquí."
                  : "Las entregas completadas aparecerán aquí."}
              </Text>
            </View>
          ) : (
            displayed.map((order) => {
              const meta = STATUS_META[order.status] ?? STATUS_META.ready;
              const items = parseItems(order.items);
              const isAction = actionId === order.id;
              const isPhoto = photoOrder === order.id;
              const hasCoords =
                order.deliveryLatitude && order.deliveryLongitude;
              const earnings = order.deliveryEarnings ?? order.deliveryFee ?? 0;

              return (
                <View
                  key={order.id}
                  style={[
                    s.card,
                    {
                      backgroundColor: card,
                      borderColor: border,
                      borderLeftColor: meta.color,
                      borderLeftWidth: 4,
                    },
                  ]}
                >
                  {/* Card header */}
                  <View style={s.cardHeader}>
                    <View
                      style={[
                        s.statusPill,
                        { backgroundColor: meta.color + "18" },
                      ]}
                    >
                      <Feather
                        name={meta.icon as any}
                        size={12}
                        color={meta.color}
                      />
                      <Text style={[s.statusTxt, { color: meta.color }]}>
                        {meta.label}
                      </Text>
                    </View>
                    <Text style={[s.orderId, { color: sub }]}>
                      {displayOrderNumber(order)}
                    </Text>
                  </View>

                  {/* Business + address */}
                  <View style={s.cardBody}>
                    <Text style={[s.businessName, { color: text }]}>
                      {order.businessName}
                    </Text>
                    <View style={s.addrRow}>
                      <Feather name="map-pin" size={12} color={sub} />
                      <Text
                        style={[s.addrTxt, { color: sub }]}
                        numberOfLines={1}
                      >
                        {order.deliveryAddress}
                      </Text>
                    </View>
                    <Text style={[s.dateRow, { color: sub }]}>
                      {fmtDate(order.createdAt)}
                      {order.deliveredAt
                        ? ` · Entregado ${fmtDate(order.deliveredAt)}`
                        : ""}
                    </Text>
                    {order.status === "cancelled" &&
                      order.driverCancelReason && (
                        <Text style={[s.dateRow, { color: RED }]}>
                          ⚠️ Cancelado por ti — {order.driverCancelReason}
                        </Text>
                      )}
                  </View>

                  {/* Items */}
                  {items.length > 0 && (
                    <View
                      style={[
                        s.itemsBox,
                        { borderTopColor: border, borderBottomColor: border },
                      ]}
                    >
                      {items.slice(0, 2).map((it: any, i: number) => (
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
                      {items.length > 2 && (
                        <Text style={[s.itemMore, { color: sub }]}>
                          +{items.length - 2} más
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Photo upload panel */}
                  {isPhoto && (
                    <View
                      style={[
                        s.photoPanel,
                        {
                          backgroundColor: isDark ? "#222" : "#f8f9fa",
                          borderColor: border,
                        },
                      ]}
                    >
                      <Text style={[s.photoTitle, { color: text }]}>
                        📸 Foto de entrega obligatoria
                      </Text>
                      <Text style={[s.photoSub, { color: sub }]}>
                        Sube una foto del pedido entregado para confirmar.
                      </Text>
                      <View style={s.photoActions}>
                        <TouchableOpacity
                          onPress={() => fileRef.current?.click()}
                          style={[
                            s.photoBtn,
                            {
                              backgroundColor: BLUE + "15",
                              borderColor: BLUE + "40",
                            },
                          ]}
                        >
                          <Feather name="camera" size={14} color={BLUE} />
                          <Text style={[s.photoBtnTxt, { color: BLUE }]}>
                            {photoB64 ? "Cambiar foto ✓" : "Seleccionar foto"}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeliverWithPhoto(order.id)}
                          disabled={!photoB64 || isAction}
                          style={[
                            s.photoBtn,
                            {
                              backgroundColor: photoB64 ? GREEN + "15" : chipBg,
                              borderColor: photoB64 ? GREEN + "40" : border,
                            },
                          ]}
                        >
                          {isAction ? (
                            <ActivityIndicator size="small" color={GREEN} />
                          ) : (
                            <Feather
                              name="check-circle"
                              size={14}
                              color={photoB64 ? GREEN : sub}
                            />
                          )}
                          <Text
                            style={[
                              s.photoBtnTxt,
                              { color: photoB64 ? GREEN : sub },
                            ]}
                          >
                            Confirmar entrega
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            setPhotoOrder(null);
                            setPhotoB64(null);
                          }}
                        >
                          <Feather name="x" size={18} color={sub} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Footer */}
                  <View style={[s.cardFooter, { borderTopColor: border }]}>
                    <Text style={[s.earningVal, { color: GREEN }]}>
                      +{fmtEur(earnings)}
                    </Text>

                    <View style={s.footerActions}>
                      {/* Navegar — abre mapa interno si hay coords, Google Maps como fallback */}
                      {hasCoords && mode === "active" && (
                        <TouchableOpacity
                          onPress={() => {
                            if (onNavigateToMap) {
                              onNavigateToMap(
                                order.id,
                                order.deliveryLatitude!,
                                order.deliveryLongitude!,
                              );
                            } else {
                              window.open(
                                `https://www.google.com/maps/dir/?api=1&destination=${order.deliveryLatitude},${order.deliveryLongitude}`,
                                "_blank",
                              );
                            }
                          }}
                          style={[
                            s.actionBtn,
                            {
                              backgroundColor: PURPLE + "15",
                              borderColor: PURPLE + "30",
                            },
                          ]}
                        >
                          <Feather name="map" size={13} color={PURPLE} />
                          <Text style={[s.actionBtnTxt, { color: PURPLE }]}>
                            Ver en mapa
                          </Text>
                        </TouchableOpacity>
                      )}

                      {/* State machine buttons */}
                      {mode === "active" && !isPhoto && (
                        <>
                          {order.status === "ready" && (
                            <TouchableOpacity
                              onPress={() =>
                                updateStatus(order.id, "picked_up")
                              }
                              disabled={isAction}
                              style={[
                                s.actionBtn,
                                {
                                  backgroundColor: AMBER + "15",
                                  borderColor: AMBER + "30",
                                },
                              ]}
                            >
                              {isAction ? (
                                <ActivityIndicator size="small" color={AMBER} />
                              ) : (
                                <Feather
                                  name="package"
                                  size={13}
                                  color={AMBER}
                                />
                              )}
                              <Text style={[s.actionBtnTxt, { color: AMBER }]}>
                                Recoger
                              </Text>
                            </TouchableOpacity>
                          )}
                          {(order.status === "picked_up" ||
                            order.status === "preparing") && (
                            <TouchableOpacity
                              onPress={() =>
                                updateStatus(order.id, "on_the_way")
                              }
                              disabled={isAction}
                              style={[
                                s.actionBtn,
                                {
                                  backgroundColor: BLUE + "15",
                                  borderColor: BLUE + "30",
                                },
                              ]}
                            >
                              {isAction ? (
                                <ActivityIndicator size="small" color={BLUE} />
                              ) : (
                                <Feather name="truck" size={13} color={BLUE} />
                              )}
                              <Text style={[s.actionBtnTxt, { color: BLUE }]}>
                                En camino
                              </Text>
                            </TouchableOpacity>
                          )}
                          {["on_the_way", "in_transit", "arriving"].includes(
                            order.status,
                          ) && (
                            <TouchableOpacity
                              onPress={() => {
                                setPhotoOrder(order.id);
                                setPhotoB64(null);
                              }}
                              style={[
                                s.actionBtn,
                                {
                                  backgroundColor: GREEN + "15",
                                  borderColor: GREEN + "30",
                                },
                              ]}
                            >
                              <Feather
                                name="check-circle"
                                size={13}
                                color={GREEN}
                              />
                              <Text style={[s.actionBtnTxt, { color: GREEN }]}>
                                Entregar
                              </Text>
                            </TouchableOpacity>
                          )}
                          {order.status === "delivered" &&
                            !order.confirmedByCustomer && (
                              <View
                                style={[
                                  s.actionBtn,
                                  {
                                    backgroundColor: BLUE + "10",
                                    borderColor: BLUE + "20",
                                  },
                                ]}
                              >
                                <Feather name="clock" size={13} color={BLUE} />
                                <Text
                                  style={[s.actionBtnTxt, { color: BLUE }]}
                                >
                                  Esperando cliente
                                </Text>
                              </View>
                            )}
                          {order.status === "delivered" &&
                            order.confirmedByCustomer && (
                              <View
                                style={[
                                  s.actionBtn,
                                  {
                                    backgroundColor: GREEN + "15",
                                    borderColor: GREEN + "30",
                                  },
                                ]}
                              >
                                <Feather
                                  name="check-circle"
                                  size={13}
                                  color={GREEN}
                                />
                                <Text
                                  style={[s.actionBtnTxt, { color: GREEN }]}
                                >
                                  Cliente confirmó — pago liberado
                                </Text>
                              </View>
                            )}
                          {[
                            "ready",
                            "picked_up",
                            "on_the_way",
                            "in_transit",
                            "arriving",
                          ].includes(order.status) && (
                            <TouchableOpacity
                              onPress={() => {
                                setCancelOrder(order.id);
                                setCancelMode(
                                  ["picked_up", "on_the_way", "in_transit", "arriving"].includes(
                                    order.status,
                                  )
                                    ? "cancelled"
                                    : "released",
                                );
                                setCancelReason(null);
                                setCancelNote("");
                              }}
                              style={[
                                s.actionBtn,
                                {
                                  backgroundColor: RED + "10",
                                  borderColor: RED + "30",
                                },
                              ]}
                            >
                              <Feather name="x-circle" size={13} color={RED} />
                              <Text style={[s.actionBtnTxt, { color: RED }]}>
                                Cancelar pedido
                              </Text>
                            </TouchableOpacity>
                          )}
                        </>
                      )}
                    </View>

                    {/* Propina en efectivo pendiente declarada por el cliente */}
                    {order.status === "delivered" &&
                      order.pendingCashTip?.declaredBy === "customer" && (
                        <View
                          style={{
                            marginTop: 10,
                            backgroundColor: "#FFF8E1",
                            borderWidth: 1,
                            borderColor: "#F59E0B",
                            borderRadius: 10,
                            padding: 12,
                          }}
                        >
                          <Text
                            style={{
                              color: "#B45309",
                              fontWeight: "700",
                              fontSize: 13,
                            }}
                          >
                            💵 El cliente declaró una propina de{" "}
                            {(order.pendingCashTip.amountCents / 100).toFixed(
                              2,
                            )}{" "}
                            € en efectivo
                          </Text>
                          <View
                            style={{
                              flexDirection: "row",
                              gap: 8,
                              marginTop: 8,
                            }}
                          >
                            <TouchableOpacity
                              onPress={() => respondCashTip(order.id, true)}
                              style={[
                                s.actionBtn,
                                { backgroundColor: GREEN, flex: 1 },
                              ]}
                            >
                              <Text
                                style={[s.actionBtnTxt, { color: "#fff" }]}
                              >
                                La recibí
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => respondCashTip(order.id, false)}
                              style={[
                                s.actionBtn,
                                { backgroundColor: chipBg, flex: 1 },
                              ]}
                            >
                              <Text
                                style={[s.actionBtnTxt, { color: text }]}
                              >
                                No la recibí
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}

                    {/* Cancelar pedido: motivo + nota (libera o cancela) */}
                    {cancelOrder === order.id && (
                      <View
                        style={{
                          marginTop: 10,
                          backgroundColor: RED + "0a",
                          borderWidth: 1,
                          borderColor: RED + "40",
                          borderRadius: 10,
                          padding: 12,
                          gap: 8,
                        }}
                      >
                        <Text
                          style={{ color: RED, fontWeight: "700", fontSize: 13 }}
                        >
                          ⚠️{" "}
                          {cancelMode === "released"
                            ? "El pedido volverá a estar disponible para otros repartidores."
                            : "Ya recogiste el pedido: se cancelará y se reembolsará al cliente."}
                        </Text>
                        <View
                          style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                        >
                          {[
                            { id: "vehicle_breakdown", label: "🔧 Avería del vehículo" },
                            { id: "traffic", label: "🚦 Mucho tráfico" },
                            { id: "personal_issue", label: "🙋 Problema personal" },
                            { id: "other", label: "📝 Otro motivo" },
                          ].map((opt) => (
                            <TouchableOpacity
                              key={opt.id}
                              onPress={() => setCancelReason(opt.id)}
                              style={{
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 999,
                                borderWidth: 1,
                                borderColor:
                                  cancelReason === opt.id ? RED : border,
                                backgroundColor:
                                  cancelReason === opt.id ? RED + "15" : "transparent",
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontWeight: "600",
                                  color: cancelReason === opt.id ? RED : text,
                                }}
                              >
                                {opt.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        <TextInput
                          style={[
                            s.searchInput,
                            {
                              color: text,
                              borderWidth: 1,
                              borderColor: border,
                              borderRadius: 8,
                              paddingHorizontal: 10,
                              paddingVertical: 8,
                              fontSize: 13,
                            },
                          ]}
                          placeholder="Nota opcional (máx. 120 caracteres)"
                          placeholderTextColor={sub}
                          value={cancelNote}
                          maxLength={120}
                          onChangeText={setCancelNote}
                        />
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <TouchableOpacity
                            onPress={submitDriverCancel}
                            disabled={!cancelReason || cancelling}
                            style={[
                              s.actionBtn,
                              {
                                backgroundColor: RED,
                                opacity: !cancelReason || cancelling ? 0.6 : 1,
                              },
                            ]}
                          >
                            {cancelling ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : null}
                            <Text style={[s.actionBtnTxt, { color: "#fff" }]}>
                              {cancelling
                                ? "Procesando..."
                                : cancelMode === "released"
                                  ? "Sí, liberar el pedido"
                                  : "Sí, cancelar y reembolsar"}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              setCancelOrder(null);
                              setCancelReason(null);
                              setCancelNote("");
                            }}
                            style={[s.actionBtn, { backgroundColor: chipBg }]}
                          >
                            <Text style={[s.actionBtnTxt, { color: text }]}>
                              Volver
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
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
    gap: 16,
  },
  headerLeft: { flex: 1 },
  title: { fontSize: 20, fontWeight: "800" },
  subtitle: { fontSize: 12, marginTop: 2 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 220,
  },
  searchInput: { flex: 1, fontSize: 13 },
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
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusTxt: { fontSize: 11, fontWeight: "700" },
  orderId: { fontSize: 11 },
  cardBody: { paddingHorizontal: 16, paddingBottom: 12, gap: 4 },
  businessName: { fontSize: 15, fontWeight: "700" },
  addrRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  addrTxt: { fontSize: 12, flex: 1 },
  dateRow: { fontSize: 11 },
  itemsBox: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    gap: 3,
  },
  itemRow: { fontSize: 12 },
  itemMore: { fontSize: 11, marginTop: 2 },
  photoPanel: {
    margin: 16,
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  photoTitle: { fontSize: 14, fontWeight: "700" },
  photoSub: { fontSize: 12 },
  photoActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  photoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  photoBtnTxt: { fontSize: 12, fontWeight: "600" },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderTopWidth: 1,
  },
  earningVal: { fontSize: 20, fontWeight: "900" },
  footerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnTxt: { fontSize: 12, fontWeight: "700" },
});
