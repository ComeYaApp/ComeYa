import React, { useState, useEffect, useRef, useCallback } from "react";
import { displayOrderNumber } from "@/utils/orderNumber";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import {
  ComeYaColors,
  Spacing,
  BorderRadius,
  Shadows,
} from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { useAuth } from "@/contexts/AuthContext";
import { fetchRouteDirections, distanceMeters } from "@/utils/directions";
import { loadGoogleMaps } from "@/utils/googleMapsWeb";
import { routePhaseForStatus } from "@/utils/routePhase";
import { animateMarkerTo } from "@/utils/smoothMarker";
import {
  pinIcon,
  driverIcon,
  asGoogleIcon,
} from "@/utils/webMarkerSvg";
import { vehicleMarkerMeta, CUSTOMER_MARKER } from "@/utils/markerMeta";

const SORIA = { lat: 41.7636, lng: -2.4677 };

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  pending: { label: "Esperando", color: "#F59E0B", icon: "clock" },
  accepted: { label: "Aceptado", color: "#3B82F6", icon: "check" },
  preparing: { label: "Preparando", color: "#8B5CF6", icon: "package" },
  ready: { label: "Listo", color: "#10B981", icon: "check-circle" },
  picked_up: { label: "Recogido", color: "#F97316", icon: "shopping-bag" },
  on_the_way: { label: "En camino", color: "#E60000", icon: "truck" },
  in_transit: { label: "En camino", color: "#E60000", icon: "truck" },
  arriving: { label: "Llegando", color: "#E60000", icon: "map-pin" },
};

interface Delivery {
  orderId: string;
  orderNumber?: number | null;
  status: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
  minutesActive: number;
  businessId?: string | null;
  businessName: string;
  customer: {
    name: string;
    phone: string;
    lat: number | null;
    lng: number | null;
    address: string | null;
  };
  driver: {
    id: string;
    rowId?: string;
    name: string;
    phone: string;
    lat: number | null;
    lng: number | null;
    lastUpdate?: string | null;
    vehicleType: string;
    rating: string | null;
  } | null;
}

interface Stats {
  totalActive: number;
  pending: number;
  preparing: number;
  onTheWay: number;
  avgMinutes: number;
  pendingRevenue: number;
}

export default function BusinessDeliveryMapScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();

  const mapRef = useRef<HTMLDivElement>(null);
  const gmap = useRef<any>(null);
  const markers = useRef<Record<string, any>>({});
  const lines = useRef<Record<string, any>>({});
  const routeCache = useRef<
    Record<string, { point: { lat: number; lng: number }; phase?: string; coords: { lat: number; lng: number }[] }>
  >({});

  const [mapsReady, setMapsReady] = useState(false);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [businessLocs, setBusinessLocs] = useState<
    { id: string; lat: number; lng: number }[]
  >([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selected, setSelected] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const businessLocById = useCallback(
    (id?: string | null) => {
      if (!id) return null;
      const b = businessLocs.find((x) => x.id === id);
      return b ? { lat: b.lat, lng: b.lng } : null;
    },
    [businessLocs],
  );

  // ── Cargar Google Maps ──────────────────────────────────────────────────────
  useEffect(() => {
    loadGoogleMaps(["geometry"])
      .then(() => setMapsReady(true))
      .catch(console.error);
  }, []);

  // ── Inicializar mapa ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapsReady || !mapRef.current || gmap.current) return;
    const google = (window as any).google;
    gmap.current = new google.maps.Map(mapRef.current, {
      center: SORIA,
      zoom: 13,
      disableDefaultUI: true,
      zoomControl: true,
      styles: isDark ? DARK_STYLE : LIGHT_STYLE,
      gestureHandling: "greedy",
    });
  }, [mapsReady, isDark]);

  // ── Fetch entregas activas ──────────────────────────────────────────────────
  const fetchDeliveries = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/business/active-deliveries");
      const data = await res.json();
      if (data.success) {
        setDeliveries(data.deliveries || []);
        setStats(data.stats || null);
        setLastUpdated(new Date());
        if (Array.isArray(data.businesses)) {
          setBusinessLocs(
            data.businesses
              .filter((b: any) => b.latitude && b.longitude)
              .map((b: any) => ({
                id: b.id,
                lat: parseFloat(b.latitude),
                lng: parseFloat(b.longitude),
              })),
          );
        }
      }
    } catch (e) {
      console.error("Error fetching deliveries:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeliveries();
    const interval = setInterval(fetchDeliveries, 15000);
    return () => clearInterval(interval);
  }, [fetchDeliveries]);

  // ── Repartidor EN VIVO por websocket (sala business:{id}) — antes los
  // pines saltaban cada 15 s; ahora se mueven cada ~2 s. El polling queda
  // como respaldo para estados/estadísticas/rutas.
  const businessIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    businessIdsRef.current = new Set(
      deliveries
        .map((d) => d.businessId)
        .filter((id): id is string => !!id),
    );
  }, [deliveries]);

  useEffect(() => {
    let cancelled = false;
    let socket: any = null;
    (async () => {
      try {
        const { io } = await import("socket.io-client");
        if (cancelled) return;
        socket = io(getApiUrl(), {
          transports: ["websocket", "polling"],
          reconnection: true,
        });
        const joinAll = () => {
          socket.emit("join", {
            userId: user?.id,
            role: "business_owner",
            businessId: (user as any)?.businessId,
          });
          businessIdsRef.current.forEach((bid) =>
            socket.emit("join", {
              userId: user?.id,
              role: "business_owner",
              businessId: bid,
            }),
          );
        };
        socket.on("connect", joinAll);
        socket.on("driver_location", (loc: any) => {
          const lat = Number(loc?.latitude);
          const lng = Number(loc?.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          setDeliveries((prev) =>
            prev.map((d) =>
              d.orderId === loc.orderId && d.driver
                ? { ...d, driver: { ...d.driver, lat, lng } }
                : d,
            ),
          );
        });
      } catch {
        // sin socket → el polling de 15 s sigue funcionando
      }
    })();
    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [user?.id, (user as any)?.businessId]);

  // ── Renderizar markers en el mapa (persistentes: se ANIMAN al moverse) ─────
  useEffect(() => {
    if (!mapsReady || !gmap.current) return;
    const google = (window as any).google;

    // Marcadores persistentes: si ya existen se animan hacia la nueva
    // posición (movimiento fluido); si no, se crean. Se eliminan los de
    // pedidos que ya no están activos.
    const validKeys = new Set<string>();
    deliveries.forEach((d) => {
      validKeys.add(`driver_${d.orderId}`);
      validKeys.add(`customer_${d.orderId}`);
    });
    Object.entries(markers.current).forEach(([k, m]) => {
      if (!validKeys.has(k)) {
        (m as any).setMap(null);
        delete markers.current[k];
      }
    });
    Object.entries(lines.current).forEach(([k, l]) => {
      if (!k.startsWith("line_")) return;
      const orderId = k.slice(5);
      if (!deliveries.some((d) => d.orderId === orderId)) {
        (l as any).setMap(null);
        delete lines.current[k];
      }
    });

    deliveries.forEach((d) => {
      const cfg = STATUS_CONFIG[d.status] || STATUS_CONFIG.pending;
      const color = cfg.color;

      // Marker repartidor — su vehículo (animado entre updates; con el
      // websocket en vivo el cadence es ~2 s, no los 15 s del polling)
      if (d.driver?.lat && d.driver?.lng) {
        const vehicle = vehicleMarkerMeta(d.driver.vehicleType);
        const key = `driver_${d.orderId}`;
        const pos = { lat: d.driver.lat, lng: d.driver.lng };
        let driverMarker = markers.current[key];
        if (driverMarker) {
          animateMarkerTo(driverMarker, pos, 1900);
        } else {
          driverMarker = new google.maps.Marker({
            position: pos,
            map: gmap.current,
            icon: asGoogleIcon(google, driverIcon(vehicle.icon)),
            title: `Repartidor: ${d.driver.name}`,
            zIndex: 20,
          });
          driverMarker.addListener("click", () => setSelected(d));
          markers.current[key] = driverMarker;
        }
      } else if (markers.current[`driver_${d.orderId}`]) {
        markers.current[`driver_${d.orderId}`].setMap(null);
        delete markers.current[`driver_${d.orderId}`];
      }

      // Marker cliente — casa con color de estado
      if (d.customer.lat && d.customer.lng) {
        const key = `customer_${d.orderId}`;
        const pos = { lat: d.customer.lat, lng: d.customer.lng };
        if (!markers.current[key]) {
          const customerMarker = new google.maps.Marker({
            position: pos,
            map: gmap.current,
            icon: asGoogleIcon(google, pinIcon(color, CUSTOMER_MARKER.icon)),
            title: `Cliente: ${d.customer.name}`,
            zIndex: 10,
          });
          customerMarker.addListener("click", () => setSelected(d));
          markers.current[key] = customerMarker;
        }
      }

      // Línea del repartidor según la FASE del pedido (misma lógica que los
      // demás mapas): recogida → repartidor→NEGOCIO; entrega → repartidor→CLIENTE.
      // SOLO rutas reales por calles — sin geometría no se dibuja línea.
      if (d.driver?.lat && d.driver?.lng) {
        const phase = routePhaseForStatus(d.status);
        const dest =
          phase === "to_business"
            ? businessLocById(d.businessId)
            : phase === "to_customer" && d.customer.lat && d.customer.lng
              ? { lat: d.customer.lat, lng: d.customer.lng }
              : null;

        if (dest) {
          const drawLine = (path: { lat: number; lng: number }[]) => {
            if (lines.current[`line_${d.orderId}`]) {
              lines.current[`line_${d.orderId}`].setMap(null);
            }
            lines.current[`line_${d.orderId}`] = new google.maps.Polyline({
              path,
              geodesic: true,
              strokeColor: color,
              strokeOpacity: 0.6,
              strokeWeight: 2,
              map: gmap.current,
            });
          };

          const driverPoint = { lat: d.driver.lat, lng: d.driver.lng };
          const cached = routeCache.current[d.orderId];
          const needsFetch =
            !cached ||
            cached.phase !== phase ||
            distanceMeters(
              { latitude: cached.point.lat, longitude: cached.point.lng },
              { latitude: driverPoint.lat, longitude: driverPoint.lng },
            ) > 100;

          if (needsFetch) {
            fetchRouteDirections(
              { latitude: driverPoint.lat, longitude: driverPoint.lng },
              { latitude: dest.lat, longitude: dest.lng },
            )
              .then((route) => {
                if (route && route.coordinates.length >= 2) {
                  routeCache.current[d.orderId] = {
                    point: driverPoint,
                    phase,
                    coords: route.coordinates.map((c) => ({
                      lat: c.latitude,
                      lng: c.longitude,
                    })),
                  };
                  if (gmap.current) {
                    drawLine(routeCache.current[d.orderId].coords);
                  }
                }
              })
              .catch(() => {});
          } else if (cached?.coords?.length) {
            drawLine(cached.coords);
          }
        } else if (lines.current[`line_${d.orderId}`]) {
          // Sin destino de ruta (sin fase válida): fuera la línea
          lines.current[`line_${d.orderId}`].setMap(null);
          delete lines.current[`line_${d.orderId}`];
        }
      }
    });
  }, [mapsReady, deliveries, businessLocs, businessLocById]);

  // ── Centrar mapa en entrega seleccionada ────────────────────────────────────
  const focusDelivery = useCallback((d: Delivery) => {
    setSelected(d);
    if (!gmap.current) return;
    const lat = d.driver?.lat || d.customer.lat;
    const lng = d.driver?.lng || d.customer.lng;
    if (lat && lng) {
      gmap.current.panTo({ lat, lng });
      gmap.current.setZoom(15);
    }
  }, []);

  const bg = isDark ? "#111" : "#f5f5f5";
  const card = isDark ? "#1e1e1e" : "#fff";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const bord = isDark ? "#333" : "#e0e0e0";

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      {/* ── Sidebar izquierdo ─────────────────────────────────────────────── */}
      {sidebarOpen && (
        <View
          style={[s.sidebar, { backgroundColor: card, borderRightColor: bord }]}
        >
          {/* Header sidebar */}
          <View
            style={[
              s.sideHeader,
              { borderBottomColor: bord, paddingTop: insets.top + 12 },
            ]}
          >
            <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
              <Feather name="arrow-left" size={20} color={text} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <ThemedText type="h4" style={{ color: text }}>
                Supervisión GPS
              </ThemedText>
              {lastUpdated && (
                <ThemedText type="caption" style={{ color: sub }}>
                  Actualizado{" "}
                  {lastUpdated.toLocaleTimeString("es-ES", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </ThemedText>
              )}
            </View>
            <Pressable
              onPress={fetchDeliveries}
              style={[
                s.refreshBtn,
                { backgroundColor: ComeYaColors.primary + "15" },
              ]}
            >
              <Feather
                name="refresh-cw"
                size={16}
                color={ComeYaColors.primary}
              />
            </Pressable>
          </View>

          {/* Stats rápidas */}
          {stats && (
            <View style={[s.statsGrid, { borderBottomColor: bord }]}>
              {[
                {
                  label: "Activos",
                  value: stats.totalActive,
                  color: ComeYaColors.primary,
                },
                { label: "Esperando", value: stats.pending, color: "#F59E0B" },
                { label: "En camino", value: stats.onTheWay, color: "#E60000" },
                {
                  label: "Tiempo med",
                  value: `${stats.avgMinutes}m`,
                  color: "#8B5CF6",
                },
              ].map((st) => (
                <View
                  key={st.label}
                  style={[s.statBox, { backgroundColor: st.color + "12" }]}
                >
                  <ThemedText
                    type="h4"
                    style={{ color: st.color, fontWeight: "900" }}
                  >
                    {st.value}
                  </ThemedText>
                  <ThemedText
                    type="caption"
                    style={{ color: sub, marginTop: 2 }}
                  >
                    {st.label}
                  </ThemedText>
                </View>
              ))}
            </View>
          )}

          {/* Ingresos pendientes */}
          {stats && stats.pendingRevenue > 0 && (
            <View
              style={[
                s.revenueBar,
                { backgroundColor: "#10B981" + "12", borderBottomColor: bord },
              ]}
            >
              <Feather name="trending-up" size={16} color="#10B981" />
              <ThemedText
                type="body"
                style={{ color: "#10B981", fontWeight: "700", marginLeft: 8 }}
              >
                {(stats.pendingRevenue / 100).toFixed(2)} € pendiente de cobro
              </ThemedText>
            </View>
          )}

          {/* Lista de entregas */}
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={{ padding: 32, alignItems: "center" }}>
                <ActivityIndicator color={ComeYaColors.primary} />
              </View>
            ) : deliveries.length === 0 ? (
              <View style={{ padding: 32, alignItems: "center", gap: 12 }}>
                <Feather name="check-circle" size={40} color="#10B981" />
                <ThemedText
                  type="body"
                  style={{ color: sub, textAlign: "center" }}
                >
                  No hay entregas activas ahora mismo
                </ThemedText>
              </View>
            ) : (
              deliveries.map((d) => {
                const cfg = STATUS_CONFIG[d.status] || STATUS_CONFIG.pending;
                const isSelec = selected?.orderId === d.orderId;
                return (
                  <Pressable
                    key={d.orderId}
                    onPress={() => focusDelivery(d)}
                    style={[
                      s.deliveryRow,
                      {
                        borderBottomColor: bord,
                        backgroundColor: isSelec
                          ? cfg.color + "10"
                          : "transparent",
                      },
                    ]}
                  >
                    {/* Estado */}
                    <View
                      style={[s.statusDot, { backgroundColor: cfg.color }]}
                    />

                    <View style={{ flex: 1, marginLeft: 10 }}>
                      {/* Pedido + tiempo */}
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <ThemedText
                          type="small"
                          style={{ color: text, fontWeight: "700" }}
                        >
                          {displayOrderNumber(d)}
                        </ThemedText>
                        <View
                          style={[
                            s.timeBadge,
                            {
                              backgroundColor:
                                d.minutesActive > 30
                                  ? "#EF444420"
                                  : "#10B98120",
                            },
                          ]}
                        >
                          <Feather
                            name="clock"
                            size={10}
                            color={d.minutesActive > 30 ? "#EF4444" : "#10B981"}
                          />
                          <ThemedText
                            type="caption"
                            style={{
                              color:
                                d.minutesActive > 30 ? "#EF4444" : "#10B981",
                              marginLeft: 3,
                            }}
                          >
                            {d.minutesActive}m
                          </ThemedText>
                        </View>
                      </View>

                      {/* Cliente */}
                      <ThemedText
                        type="caption"
                        style={{ color: sub, marginTop: 2 }}
                        numberOfLines={1}
                      >
                        👤 {d.customer.name} ·{" "}
                        {d.customer.address || "Sin dirección"}
                      </ThemedText>

                      {/* Repartidor */}
                      {d.driver ? (
                        <ThemedText
                          type="caption"
                          style={{ color: cfg.color, marginTop: 2 }}
                          numberOfLines={1}
                        >
                          🛵 {d.driver.name}{" "}
                          {d.driver.rating ? `· ⭐${d.driver.rating}` : ""}
                        </ThemedText>
                      ) : (
                        <ThemedText
                          type="caption"
                          style={{ color: "#F59E0B", marginTop: 2 }}
                        >
                          ⚠️ Sin repartidor asignado
                        </ThemedText>
                      )}

                      {/* Importe */}
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          marginTop: 4,
                        }}
                      >
                        <View
                          style={[
                            s.statusChip,
                            { backgroundColor: cfg.color + "20" },
                          ]}
                        >
                          <ThemedText
                            type="caption"
                            style={{ color: cfg.color, fontWeight: "700" }}
                          >
                            {cfg.label}
                          </ThemedText>
                        </View>
                        <ThemedText
                          type="caption"
                          style={{ color: text, fontWeight: "700" }}
                        >
                          {(d.total / 100).toFixed(2)} €
                        </ThemedText>
                      </View>
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          {/* Footer sidebar */}
          <View
            style={[
              s.sideFooter,
              { borderTopColor: bord, paddingBottom: insets.bottom + 8 },
            ]}
          >
            <Pressable
              onPress={() => navigation.navigate("BusinessOrders")}
              style={[s.footerBtn, { backgroundColor: ComeYaColors.primary }]}
            >
              <Feather name="list" size={15} color="#fff" />
              <ThemedText
                type="small"
                style={{ color: "#fff", fontWeight: "700", marginLeft: 6 }}
              >
                Ver todos los pedidos
              </ThemedText>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Mapa ──────────────────────────────────────────────────────────── */}
      <View style={{ flex: 1, position: "relative" as any }}>
        <div ref={mapRef} style={{ position: "absolute", inset: 0 }} />

        {/* Loading overlay */}
        {(!mapsReady || loading) && (
          <View style={s.loadingOverlay}>
            <ActivityIndicator size="large" color={ComeYaColors.primary} />
            <ThemedText type="body" style={{ marginTop: 12, color: sub }}>
              Cargando mapa...
            </ThemedText>
          </View>
        )}

        {/* Toggle sidebar */}
        <Pressable
          onPress={() => setSidebarOpen((v) => !v)}
          style={[s.toggleBtn, { backgroundColor: card, top: insets.top + 12 }]}
        >
          <Feather
            name={sidebarOpen ? "sidebar" : "menu"}
            size={20}
            color={text}
          />
        </Pressable>

        {/* Leyenda */}
        <View
          style={[
            s.legend,
            { backgroundColor: card, bottom: insets.bottom + 16 },
          ]}
        >
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <View key={key} style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: cfg.color }]} />
              <ThemedText type="caption" style={{ color: sub, fontSize: 10 }}>
                {cfg.label}
              </ThemedText>
            </View>
          ))}
        </View>

        {/* Panel detalle pedido seleccionado */}
        {selected && (
          <View
            style={[
              s.detailPanel,
              {
                backgroundColor: card,
                borderColor: bord,
                bottom: insets.bottom + 16,
              },
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <ThemedText type="h4" style={{ color: text }}>
                Pedido {displayOrderNumber(selected)}
              </ThemedText>
              <Pressable onPress={() => setSelected(null)}>
                <Feather name="x" size={20} color={sub} />
              </Pressable>
            </View>

            <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
              {/* Cliente */}
              <View
                style={[
                  s.detailCard,
                  { backgroundColor: "#3B82F6" + "10", flex: 1 },
                ]}
              >
                <ThemedText
                  type="caption"
                  style={{
                    color: "#3B82F6",
                    fontWeight: "700",
                    marginBottom: 4,
                  }}
                >
                  👤 CLIENTE
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: text, fontWeight: "600" }}
                >
                  {selected.customer.name}
                </ThemedText>
                <ThemedText type="caption" style={{ color: sub }}>
                  {selected.customer.phone}
                </ThemedText>
                {selected.customer.address && (
                  <ThemedText
                    type="caption"
                    style={{ color: sub, marginTop: 2 }}
                    numberOfLines={2}
                  >
                    {selected.customer.address}
                  </ThemedText>
                )}
                {selected.customer.lat && (
                  <Pressable
                    onPress={() => {
                      gmap.current?.panTo({
                        lat: selected.customer.lat!,
                        lng: selected.customer.lng!,
                      });
                      gmap.current?.setZoom(16);
                      setSelected(null);
                    }}
                    style={{
                      marginTop: 6,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Feather name="map-pin" size={11} color="#3B82F6" />
                    <ThemedText type="caption" style={{ color: "#3B82F6" }}>
                      Ver en mapa
                    </ThemedText>
                  </Pressable>
                )}
              </View>

              {/* Repartidor */}
              <View
                style={[
                  s.detailCard,
                  {
                    backgroundColor:
                      (STATUS_CONFIG[selected.status]?.color || "#E60000") +
                      "10",
                    flex: 1,
                  },
                ]}
              >
                <ThemedText
                  type="caption"
                  style={{
                    color: STATUS_CONFIG[selected.status]?.color || "#E60000",
                    fontWeight: "700",
                    marginBottom: 4,
                  }}
                >
                  🛵 REPARTIDOR
                </ThemedText>
                {selected.driver ? (
                  <>
                    <ThemedText
                      type="small"
                      style={{ color: text, fontWeight: "600" }}
                    >
                      {selected.driver.name}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: sub }}>
                      {selected.driver.phone}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: sub }}>
                      {selected.driver.vehicleType}{" "}
                      {selected.driver.rating
                        ? `· ⭐ ${selected.driver.rating}`
                        : ""}
                    </ThemedText>
                    {selected.driver.lat && (
                      <Pressable
                        onPress={() => {
                          gmap.current?.panTo({
                            lat: selected.driver!.lat!,
                            lng: selected.driver!.lng!,
                          });
                          gmap.current?.setZoom(16);
                          setSelected(null);
                        }}
                        style={{
                          marginTop: 6,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Feather
                          name="navigation"
                          size={11}
                          color={
                            STATUS_CONFIG[selected.status]?.color || "#E60000"
                          }
                        />
                        <ThemedText
                          type="caption"
                          style={{
                            color:
                              STATUS_CONFIG[selected.status]?.color ||
                              "#E60000",
                          }}
                        >
                          Ver ubicación
                        </ThemedText>
                      </Pressable>
                    )}
                  </>
                ) : (
                  <ThemedText type="caption" style={{ color: "#F59E0B" }}>
                    Sin asignar
                  </ThemedText>
                )}
              </View>
            </View>

            {/* Financiero */}
            <View style={[s.finRow, { borderTopColor: bord }]}>
              {[
                {
                  label: "Subtotal",
                  value: `${(selected.subtotal / 100).toFixed(2)} €`,
                },
                {
                  label: "Envío",
                  value: `${(selected.deliveryFee / 100).toFixed(2)} €`,
                },
                {
                  label: "Total",
                  value: `${(selected.total / 100).toFixed(2)} €`,
                  bold: true,
                },
                { label: "Pago", value: selected.paymentMethod },
                {
                  label: "Tiempo",
                  value: `${selected.minutesActive} min`,
                  color: selected.minutesActive > 30 ? "#EF4444" : "#10B981",
                },
              ].map((item) => (
                <View key={item.label} style={s.finItem}>
                  <ThemedText type="caption" style={{ color: sub }}>
                    {item.label}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{
                      color: item.color || text,
                      fontWeight: item.bold ? "900" : "600",
                    }}
                  >
                    {item.value}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────────────
const DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#373737" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#000000" }],
  },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
];

const LIGHT_STYLE = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "row" },
  sidebar: { width: 320, flexDirection: "column" as any, borderRightWidth: 1 },
  sideHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap" as any,
    gap: 8,
    padding: 12,
    borderBottomWidth: 1,
  },
  statBox: {
    flex: 1,
    minWidth: 60,
    padding: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  revenueBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
  },
  deliveryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderBottomWidth: 1,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  timeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  sideFooter: { padding: 12, borderTopWidth: 1 },
  footerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
  },
  loadingOverlay: {
    position: "absolute" as any,
    inset: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.85)",
    zIndex: 20,
  },
  toggleBtn: {
    position: "absolute" as any,
    left: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
  },
  legend: {
    position: "absolute" as any,
    right: 12,
    flexDirection: "row",
    flexWrap: "wrap" as any,
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    maxWidth: 200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  detailPanel: {
    position: "absolute" as any,
    left: 12,
    right: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
    zIndex: 10,
  },
  detailCard: { padding: 10, borderRadius: 10 },
  finRow: {
    flexDirection: "row",
    flexWrap: "wrap" as any,
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    marginTop: 4,
  },
  finItem: { alignItems: "center", minWidth: 60 },
});
