import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { ComeYaColors, Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY || "";
const SORIA = { lat: 41.7636, lng: -2.4677 };

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  pending:    { label: "Esperando",  color: "#F59E0B", icon: "clock"       },
  accepted:   { label: "Aceptado",   color: "#3B82F6", icon: "check"       },
  preparing:  { label: "Preparando", color: "#8B5CF6", icon: "package"     },
  ready:      { label: "Listo",      color: "#10B981", icon: "check-circle"},
  on_the_way: { label: "En camino",  color: "#DC2626", icon: "truck"       },
};

interface Delivery {
  orderId: string;
  status: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
  minutesActive: number;
  businessName: string;
  customer: { name: string; phone: string; lat: number | null; lng: number | null; address: string | null };
  driver: { id: string; name: string; phone: string; lat: number | null; lng: number | null; vehicleType: string; rating: string | null } | null;
}

interface Stats {
  totalActive: number;
  pending: number;
  preparing: number;
  onTheWay: number;
  avgMinutes: number;
  pendingRevenue: number;
}

function loadGoogleMaps(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.maps) { resolve(); return; }
    const existing = document.getElementById("gmap-script");
    if (existing) { existing.addEventListener("load", () => resolve()); return; }
    const script = document.createElement("script");
    script.id = "gmap-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

interface BusinessPin {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export default function BusinessDeliveryMapScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { theme, isDark } = useTheme();

  const mapRef   = useRef<HTMLDivElement>(null);
  const gmap     = useRef<any>(null);
  const markers  = useRef<Record<string, any>>({});
  const lines    = useRef<Record<string, any>>({});

  const [mapsReady,    setMapsReady]    = useState(false);
  const [deliveries,   setDeliveries]   = useState<Delivery[]>([]);
  const [businesses,   setBusinesses]   = useState<BusinessPin[]>([]);
  const [stats,        setStats]        = useState<Stats | null>(null);
  const [selected,     setSelected]     = useState<Delivery | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [lastUpdated,  setLastUpdated]  = useState<Date | null>(null);
  const [sidebarOpen,  setSidebarOpen]  = useState(true);

  // ── Cargar Google Maps ──────────────────────────────────────────────────────
  useEffect(() => {
    loadGoogleMaps().then(() => setMapsReady(true)).catch(console.error);
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
      const res  = await apiRequest("GET", "/api/business/active-deliveries");
      const data = await res.json();
      if (data.success) {
        setDeliveries(data.deliveries || []);
        setStats(data.stats || null);
        setLastUpdated(new Date());
        // Guardar negocios con coordenadas
        const bizPins: BusinessPin[] = (data.businesses || []).filter(
          (b: any) => b.latitude && b.longitude
        ).map((b: any) => ({
          id: b.id,
          name: b.name,
          lat: parseFloat(b.latitude),
          lng: parseFloat(b.longitude),
        }));
        setBusinesses(bizPins);
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

  // ── Renderizar markers en el mapa ───────────────────────────────────────────
  useEffect(() => {
    if (!mapsReady || !gmap.current) return;
    const google = (window as any).google;

    // Limpiar todo
    Object.values(markers.current).forEach((m: any) => m.setMap(null));
    Object.values(lines.current).forEach((l: any) => l.setMap(null));
    markers.current = {};
    lines.current   = {};

    // ── Pin del negocio (tienda) ──────────────────────────────────────────
    businesses.forEach((biz) => {
      const bizSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48">
        <circle cx="24" cy="24" r="22" fill="#DC2626" stroke="#fff" stroke-width="3"/>
        <text x="24" y="30" text-anchor="middle" font-size="20" fill="white">🏪</text>
      </svg>`;
      const bizMarker = new google.maps.Marker({
        position: { lat: biz.lat, lng: biz.lng },
        map: gmap.current,
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(bizSvg)}`,
          scaledSize: new google.maps.Size(48, 48),
          anchor: new google.maps.Point(24, 24),
        },
        title: biz.name,
        zIndex: 30,
      });
      markers.current[`biz_${biz.id}`] = bizMarker;
    });

    deliveries.forEach((d) => {
      const cfg   = STATUS_CONFIG[d.status] || STATUS_CONFIG.pending;
      const color = cfg.color;
      const isOnTheWay = d.status === 'on_the_way';

      // ── Pin cliente (siempre visible si tiene coords) ─────────────────
      if (d.customer.lat && d.customer.lng) {
        const customerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48">
          <ellipse cx="20" cy="18" rx="18" ry="18" fill="${color}" stroke="#fff" stroke-width="2.5"/>
          <text x="20" y="24" text-anchor="middle" font-size="16" fill="white">🏠</text>
          <polygon points="12,34 28,34 20,48" fill="${color}"/>
        </svg>`;
        const customerMarker = new google.maps.Marker({
          position: { lat: d.customer.lat, lng: d.customer.lng },
          map: gmap.current,
          icon: {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(customerSvg)}`,
            scaledSize: new google.maps.Size(40, 48),
            anchor: new google.maps.Point(20, 48),
          },
          title: `Cliente: ${d.customer.name}`,
          zIndex: 10,
        });
        customerMarker.addListener("click", () => setSelected(d));
        markers.current[`customer_${d.orderId}`] = customerMarker;

        // ── Línea negocio → cliente (roja punteada) cuando no hay driver en camino
        const biz = businesses.find(b =>
          deliveries.some(del => del.orderId === d.orderId)
        ) || businesses[0];

        if (biz && !isOnTheWay) {
          const lineToCustomer = new google.maps.Polyline({
            path: [
              { lat: biz.lat, lng: biz.lng },
              { lat: d.customer.lat, lng: d.customer.lng },
            ],
            geodesic: true,
            strokeColor: color,
            strokeOpacity: 0,
            strokeWeight: 0,
            icons: [{
              icon: {
                path: 'M 0,-1 0,1',
                strokeOpacity: 0.8,
                strokeColor: color,
                strokeWeight: 3,
                scale: 4,
              },
              offset: '0',
              repeat: '20px',
            }],
            map: gmap.current,
          });
          lines.current[`biz_to_customer_${d.orderId}`] = lineToCustomer;
        }
      }

      // ── Pin repartidor + línea verde sólida cuando está en camino ─────
      if (d.driver?.lat && d.driver?.lng) {
        const driverSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44">
          <circle cx="22" cy="22" r="20" fill="${isOnTheWay ? '#10B981' : color}" stroke="#fff" stroke-width="3"/>
          <text x="22" y="28" text-anchor="middle" font-size="18" fill="white">🛵</text>
        </svg>`;
        const driverMarker = new google.maps.Marker({
          position: { lat: d.driver.lat, lng: d.driver.lng },
          map: gmap.current,
          icon: {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(driverSvg)}`,
            scaledSize: new google.maps.Size(44, 44),
            anchor: new google.maps.Point(22, 22),
          },
          title: `Repartidor: ${d.driver.name}`,
          zIndex: 20,
        });
        driverMarker.addListener("click", () => setSelected(d));
        markers.current[`driver_${d.orderId}`] = driverMarker;

        // Línea verde sólida driver → cliente cuando está en camino
        if (d.customer.lat && d.customer.lng) {
          const driverLine = new google.maps.Polyline({
            path: [
              { lat: d.driver.lat, lng: d.driver.lng },
              { lat: d.customer.lat, lng: d.customer.lng },
            ],
            geodesic: true,
            strokeColor: '#10B981',
            strokeOpacity: 0.9,
            strokeWeight: 4,
            map: gmap.current,
          });
          lines.current[`driver_to_customer_${d.orderId}`] = driverLine;
        }
      }
    });
  }, [mapsReady, deliveries, businesses]);

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

  const bg   = isDark ? "#111" : "#f5f5f5";
  const card = isDark ? "#1e1e1e" : "#fff";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub  = isDark ? "#aaa" : "#666";
  const bord = isDark ? "#333" : "#e0e0e0";

  return (
    <View style={[s.root, { backgroundColor: bg }]}>

      {/* ── Sidebar izquierdo ─────────────────────────────────────────────── */}
      {sidebarOpen && (
        <View style={[s.sidebar, { backgroundColor: card, borderRightColor: bord }]}>

          {/* Header sidebar */}
          <View style={[s.sideHeader, { borderBottomColor: bord, paddingTop: insets.top + 12 }]}>
            <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
              <Feather name="arrow-left" size={20} color={text} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <ThemedText type="h4" style={{ color: text }}>Supervisión GPS</ThemedText>
              {lastUpdated && (
                <ThemedText type="caption" style={{ color: sub }}>
                  Actualizado {lastUpdated.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </ThemedText>
              )}
            </View>
            <Pressable onPress={fetchDeliveries} style={[s.refreshBtn, { backgroundColor: ComeYaColors.primary + "15" }]}>
              <Feather name="refresh-cw" size={16} color={ComeYaColors.primary} />
            </Pressable>
          </View>

          {/* Stats rápidas */}
          {stats && (
            <View style={[s.statsGrid, { borderBottomColor: bord }]}>
              {[
                { label: "Activos",    value: stats.totalActive, color: ComeYaColors.primary },
                { label: "Esperando",  value: stats.pending,     color: "#F59E0B"            },
                { label: "En camino",  value: stats.onTheWay,    color: "#DC2626"            },
                { label: "Tiempo med", value: `${stats.avgMinutes}m`, color: "#8B5CF6"       },
              ].map(st => (
                <View key={st.label} style={[s.statBox, { backgroundColor: st.color + "12" }]}>
                  <ThemedText type="h4" style={{ color: st.color, fontWeight: "900" }}>{st.value}</ThemedText>
                  <ThemedText type="caption" style={{ color: sub, marginTop: 2 }}>{st.label}</ThemedText>
                </View>
              ))}
            </View>
          )}

          {/* Ingresos pendientes */}
          {stats && stats.pendingRevenue > 0 && (
            <View style={[s.revenueBar, { backgroundColor: "#10B981" + "12", borderBottomColor: bord }]}>
              <Feather name="trending-up" size={16} color="#10B981" />
              <ThemedText type="body" style={{ color: "#10B981", fontWeight: "700", marginLeft: 8 }}>
                €{(stats.pendingRevenue / 100).toFixed(2)} pendiente de cobro
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
                <ThemedText type="body" style={{ color: sub, textAlign: "center" }}>
                  No hay entregas activas ahora mismo
                </ThemedText>
              </View>
            ) : (
              deliveries.map((d) => {
                const cfg     = STATUS_CONFIG[d.status] || STATUS_CONFIG.pending;
                const isSelec = selected?.orderId === d.orderId;
                return (
                  <Pressable
                    key={d.orderId}
                    onPress={() => focusDelivery(d)}
                    style={[
                      s.deliveryRow,
                      { borderBottomColor: bord, backgroundColor: isSelec ? cfg.color + "10" : "transparent" },
                    ]}
                  >
                    {/* Estado */}
                    <View style={[s.statusDot, { backgroundColor: cfg.color }]} />

                    <View style={{ flex: 1, marginLeft: 10 }}>
                      {/* Pedido + tiempo */}
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <ThemedText type="small" style={{ color: text, fontWeight: "700" }}>
                          #{d.orderId.slice(-6).toUpperCase()}
                        </ThemedText>
                        <View style={[s.timeBadge, { backgroundColor: d.minutesActive > 30 ? "#EF444420" : "#10B98120" }]}>
                          <Feather name="clock" size={10} color={d.minutesActive > 30 ? "#EF4444" : "#10B981"} />
                          <ThemedText type="caption" style={{ color: d.minutesActive > 30 ? "#EF4444" : "#10B981", marginLeft: 3 }}>
                            {d.minutesActive}m
                          </ThemedText>
                        </View>
                      </View>

                      {/* Cliente */}
                      <ThemedText type="caption" style={{ color: sub, marginTop: 2 }} numberOfLines={1}>
                        👤 {d.customer.name} · {d.customer.address || "Sin dirección"}
                      </ThemedText>

                      {/* Repartidor */}
                      {d.driver ? (
                        <ThemedText type="caption" style={{ color: cfg.color, marginTop: 2 }} numberOfLines={1}>
                          🛵 {d.driver.name} {d.driver.rating ? `· ⭐${d.driver.rating}` : ""}
                        </ThemedText>
                      ) : (
                        <ThemedText type="caption" style={{ color: "#F59E0B", marginTop: 2 }}>
                          ⚠️ Sin repartidor asignado
                        </ThemedText>
                      )}

                      {/* Importe */}
                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                        <View style={[s.statusChip, { backgroundColor: cfg.color + "20" }]}>
                          <ThemedText type="caption" style={{ color: cfg.color, fontWeight: "700" }}>{cfg.label}</ThemedText>
                        </View>
                        <ThemedText type="caption" style={{ color: text, fontWeight: "700" }}>
                          €{(d.total / 100).toFixed(2)}
                        </ThemedText>
                      </View>
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          {/* Footer sidebar */}
          <View style={[s.sideFooter, { borderTopColor: bord, paddingBottom: insets.bottom + 8 }]}>
            <Pressable
              onPress={() => navigation.navigate("BusinessOrders")}
              style={[s.footerBtn, { backgroundColor: ComeYaColors.primary }]}
            >
              <Feather name="list" size={15} color="#fff" />
              <ThemedText type="small" style={{ color: "#fff", fontWeight: "700", marginLeft: 6 }}>
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
            <ThemedText type="body" style={{ marginTop: 12, color: sub }}>Cargando mapa...</ThemedText>
          </View>
        )}

        {/* Toggle sidebar */}
        <Pressable
          onPress={() => setSidebarOpen(v => !v)}
          style={[s.toggleBtn, { backgroundColor: card, top: insets.top + 12 }]}
        >
          <Feather name={sidebarOpen ? "sidebar" : "menu"} size={20} color={text} />
        </Pressable>

        {/* Leyenda */}
        <View style={[s.legend, { backgroundColor: card, bottom: insets.bottom + 16 }]}>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: '#DC2626' }]} />
            <ThemedText type="caption" style={{ color: sub, fontSize: 10 }}>🏪 Negocio</ThemedText>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: '#3B82F6' }]} />
            <ThemedText type="caption" style={{ color: sub, fontSize: 10 }}>🏠 Cliente</ThemedText>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: '#10B981' }]} />
            <ThemedText type="caption" style={{ color: sub, fontSize: 10 }}>🛵 En camino</ThemedText>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: '#F59E0B', borderRadius: 0 }]} />
            <ThemedText type="caption" style={{ color: sub, fontSize: 10 }}>- - Ruta pendiente</ThemedText>
          </View>
        </View>

        {/* Panel detalle pedido seleccionado */}
        {selected && (
          <View style={[s.detailPanel, { backgroundColor: card, borderColor: bord, bottom: insets.bottom + 16 }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <ThemedText type="h4" style={{ color: text }}>
                Pedido #{selected.orderId.slice(-6).toUpperCase()}
              </ThemedText>
              <Pressable onPress={() => setSelected(null)}>
                <Feather name="x" size={20} color={sub} />
              </Pressable>
            </View>

            <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
              {/* Cliente */}
              <View style={[s.detailCard, { backgroundColor: "#3B82F6" + "10", flex: 1 }]}>
                <ThemedText type="caption" style={{ color: "#3B82F6", fontWeight: "700", marginBottom: 4 }}>👤 CLIENTE</ThemedText>
                <ThemedText type="small" style={{ color: text, fontWeight: "600" }}>{selected.customer.name}</ThemedText>
                <ThemedText type="caption" style={{ color: sub }}>{selected.customer.phone}</ThemedText>
                {selected.customer.address && (
                  <ThemedText type="caption" style={{ color: sub, marginTop: 2 }} numberOfLines={2}>{selected.customer.address}</ThemedText>
                )}
                {selected.customer.lat && (
                  <Pressable
                    onPress={() => window.open(`https://www.google.com/maps?q=${selected.customer.lat},${selected.customer.lng}`, "_blank")}
                    style={{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 4 }}
                  >
                    <Feather name="map-pin" size={11} color="#3B82F6" />
                    <ThemedText type="caption" style={{ color: "#3B82F6" }}>Ver en mapa</ThemedText>
                  </Pressable>
                )}
              </View>

              {/* Repartidor */}
              <View style={[s.detailCard, { backgroundColor: (STATUS_CONFIG[selected.status]?.color || "#DC2626") + "10", flex: 1 }]}>
                <ThemedText type="caption" style={{ color: STATUS_CONFIG[selected.status]?.color || "#DC2626", fontWeight: "700", marginBottom: 4 }}>🛵 REPARTIDOR</ThemedText>
                {selected.driver ? (
                  <>
                    <ThemedText type="small" style={{ color: text, fontWeight: "600" }}>{selected.driver.name}</ThemedText>
                    <ThemedText type="caption" style={{ color: sub }}>{selected.driver.phone}</ThemedText>
                    <ThemedText type="caption" style={{ color: sub }}>
                      {selected.driver.vehicleType} {selected.driver.rating ? `· ⭐ ${selected.driver.rating}` : ""}
                    </ThemedText>
                    {selected.driver.lat && (
                      <Pressable
                        onPress={() => window.open(`https://www.google.com/maps?q=${selected.driver!.lat},${selected.driver!.lng}`, "_blank")}
                        style={{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 4 }}
                      >
                        <Feather name="navigation" size={11} color={STATUS_CONFIG[selected.status]?.color || "#DC2626"} />
                        <ThemedText type="caption" style={{ color: STATUS_CONFIG[selected.status]?.color || "#DC2626" }}>Ver ubicación</ThemedText>
                      </Pressable>
                    )}
                  </>
                ) : (
                  <ThemedText type="caption" style={{ color: "#F59E0B" }}>Sin asignar</ThemedText>
                )}
              </View>
            </View>

            {/* Financiero */}
            <View style={[s.finRow, { borderTopColor: bord }]}>
              {[
                { label: "Subtotal",  value: `€${(selected.subtotal  / 100).toFixed(2)}` },
                { label: "Envío",     value: `€${(selected.deliveryFee / 100).toFixed(2)}` },
                { label: "Total",     value: `€${(selected.total      / 100).toFixed(2)}`, bold: true },
                { label: "Pago",      value: selected.paymentMethod },
                { label: "Tiempo",    value: `${selected.minutesActive} min`, color: selected.minutesActive > 30 ? "#EF4444" : "#10B981" },
              ].map(item => (
                <View key={item.label} style={s.finItem}>
                  <ThemedText type="caption" style={{ color: sub }}>{item.label}</ThemedText>
                  <ThemedText type="small" style={{ color: item.color || text, fontWeight: item.bold ? "900" : "600" }}>
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
  { elementType: "geometry",            stylers: [{ color: "#212121" }] },
  { elementType: "labels.text.fill",    stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke",  stylers: [{ color: "#212121" }] },
  { featureType: "road",                elementType: "geometry", stylers: [{ color: "#373737" }] },
  { featureType: "water",               elementType: "geometry", stylers: [{ color: "#000000" }] },
  { featureType: "poi",                 stylers: [{ visibility: "off" }] },
];

const LIGHT_STYLE = [
  { featureType: "poi",     stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

const s = StyleSheet.create({
  root:         { flex: 1, flexDirection: "row" },
  sidebar:      { width: 320, flexDirection: "column" as any, borderRightWidth: 1 },
  sideHeader:   { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn:      { width: 36, height: 36, justifyContent: "center", alignItems: "center" },
  refreshBtn:   { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  statsGrid:    { flexDirection: "row", flexWrap: "wrap" as any, gap: 8, padding: 12, borderBottomWidth: 1 },
  statBox:      { flex: 1, minWidth: 60, padding: 10, borderRadius: 10, alignItems: "center" },
  revenueBar:   { flexDirection: "row", alignItems: "center", padding: 12, borderBottomWidth: 1 },
  deliveryRow:  { flexDirection: "row", alignItems: "flex-start", padding: 12, borderBottomWidth: 1 },
  statusDot:    { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  timeBadge:    { flexDirection: "row", alignItems: "center", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  statusChip:   { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  sideFooter:   { padding: 12, borderTopWidth: 1 },
  footerBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 10 },
  loadingOverlay: {
    position: "absolute" as any, inset: 0,
    justifyContent: "center", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.85)", zIndex: 20,
  },
  toggleBtn:    {
    position: "absolute" as any, left: 12,
    width: 40, height: 40, borderRadius: 20,
    justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 4, zIndex: 10,
  },
  legend:       {
    position: "absolute" as any, right: 12,
    flexDirection: "row", flexWrap: "wrap" as any, gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 12, maxWidth: 200,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, zIndex: 10,
  },
  legendItem:   { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot:    { width: 8, height: 8, borderRadius: 4 },
  detailPanel:  {
    position: "absolute" as any, left: 12, right: 12,
    borderRadius: 16, borderWidth: 1, padding: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 12, zIndex: 10,
  },
  detailCard:   { padding: 10, borderRadius: 10 },
  finRow:       { flexDirection: "row", flexWrap: "wrap" as any, gap: 12, paddingTop: 12, borderTopWidth: 1, marginTop: 4 },
  finItem:      { alignItems: "center", minWidth: 60 },
});
