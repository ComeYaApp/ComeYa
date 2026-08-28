import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  TextInput,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors } from "@/constants/theme";
import { apiRequest, apiRequestRaw } from "@/lib/query-client";
import {
  useAdminOps,
  type OpsOrder,
  type OpsDriver,
} from "@/hooks/useAdminOps";
import { fetchRouteDirections, distanceMeters } from "@/utils/directions";
import { routePhaseForStatus } from "@/utils/routePhase";
import { animateMarkerTo } from "@/utils/smoothMarker";
import { clusterPoints, clusterSvg } from "@/utils/webClustering";
import {
  pinIcon,
  driverIcon,
  businessLabelIcon,
  asGoogleIcon,
} from "@/utils/webMarkerSvg";
import {
  businessMarkerMeta,
  vehicleMarkerMeta,
  CUSTOMER_MARKER,
} from "@/utils/markerMeta";

const SORIA = { lat: 41.7636, lng: -2.4677 };

// Todos los estados activos del enum real (antes faltaban 4 y salían en gris)
const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "#F59E0B" },
  accepted: { label: "Aceptado", color: "#3B82F6" },
  preparing: { label: "Preparando", color: "#8B5CF6" },
  ready: { label: "Listo", color: "#10B981" },
  assigned_driver: { label: "Repartidor asignado", color: "#6366F1" },
  picked_up: { label: "Recogido", color: "#0EA5E9" },
  on_the_way: { label: "En camino", color: "#DC2626" },
  in_transit: { label: "En tránsito", color: "#DC2626" },
  arriving: { label: "Llegando", color: "#EC4899" },
  delivered: { label: "Entregado", color: "#22C55E" },
  cancelled: { label: "Cancelado", color: "#6B7280" },
};

const statusMeta = (s: string) =>
  STATUS_META[s] || { label: s, color: "#6B7280" };

type LayerKey =
  | "orders"
  | "drivers"
  | "businesses"
  | "routes"
  | "heatmap"
  | "zones"
  | "traffic";

const DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1a1a1a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a1a" }] },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#2c2c2c" }],
  },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#000" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
];

function loadGoogleMaps(): Promise<void> {
  return new Promise(async (resolve, reject) => {
    if ((window as any).google?.maps?.visualization) return resolve();
    const existing = document.getElementById("gmap-script-ops");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }
    const key = await fetch(
      (process.env.EXPO_PUBLIC_BACKEND_URL || "") + "/api/config/maps-key",
    )
      .then((r) => r.json())
      .then((d) => d.key)
      .catch(() => "");
    const script = document.createElement("script");
    script.id = "gmap-script-ops";
    // visualization = heatmap; geometry = cálculos de distancia
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=visualization,geometry`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
}

// Número público del pedido (#CY000001); acepta un objeto order o un id
const fmtNum = (o: any) => {
  if (typeof o === "string") {
    return `#${o.slice(-6)}`;
  }
  const n = Number(o?.orderNumber);
  if (Number.isFinite(n) && n > 0)
    return `#CY${String(Math.trunc(n)).padStart(6, "0")}`;
  return `#${String(o?.id ?? "").slice(-6)}`;
};

const euro = (cents: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(
    (Number(cents) || 0) / 100,
  );

const stateLabelOf = (d: any) =>
  d.isBlocked
    ? "⛔ Bloqueado"
    : d.staleGps
      ? `⚠️ GPS sin señal (${d.lastUpdateMinutes ?? "?"} min)`
      : d.isOnline
        ? "✅ Conectado"
        : "⚪ Desconectado";

export default function AdminOpsCenterScreen() {
  const { theme, isDark } = useTheme();
  const mapRef = useRef<HTMLDivElement>(null);
  const gmap = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const linesRef = useRef<any[]>([]);
  // Repartidores: marcadores persistentes (animados, no se recrean)
  const driverMarkersRef = useRef<Record<string, any>>({});
  // Fetches de ruta en vuelo (evita duplicar peticiones del mismo pedido)
  const routeFetchingRef = useRef<Set<string>>(new Set());
  const heatLayerRef = useRef<any>(null);
  const trafficLayerRef = useRef<any>(null);
  const zoneShapesRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);
  const routeCacheRef = useRef<
    Record<
      string,
      { point: { lat: number; lng: number }; phase?: string; coords: any[] }
    >
  >({});

  const [mapsReady, setMapsReady] = useState(false);
  const [zoom, setZoom] = useState(13);
  const [selected, setSelected] = useState<OpsOrder | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    orders: true,
    drivers: true,
    businesses: true,
    routes: true,
    heatmap: false,
    zones: false,
    traffic: false,
  });
  const [heatmapData, setHeatmapData] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [quota, setQuota] = useState<any>(null);
  const [showQuota, setShowQuota] = useState(false);
  const [nearbyDrivers, setNearbyDrivers] = useState<any[] | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const {
    kpis,
    orders,
    drivers,
    businesses,
    loading,
    error,
    socketConnected,
    updatedAt,
    refresh,
  } = useAdminOps(15000);

  // ── Carga del mapa ──
  useEffect(() => {
    loadGoogleMaps()
      .then(() => setMapsReady(true))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!mapsReady || !mapRef.current || gmap.current) return;
    const google = (window as any).google;
    gmap.current = new google.maps.Map(mapRef.current, {
      center: SORIA,
      zoom: 13,
      disableDefaultUI: true,
      zoomControl: true,
      styles: isDark ? DARK_STYLE : [],
      gestureHandling: "greedy",
    });
    infoWindowRef.current = new google.maps.InfoWindow();
    gmap.current.addListener("zoom_changed", () =>
      setZoom(gmap.current?.getZoom() || 13),
    );
  }, [mapsReady, isDark]);

  // ── Datos auxiliares de capas ──
  const loadHeatmap = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/gps/heatmap?days=30");
      const data = await res.json();
      if (data.success) setHeatmapData(data.heatmap || []);
    } catch {}
  }, []);

  const loadZones = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/admin/delivery-zones");
      const data = await res.json();
      setZones(data.zones || data || []);
    } catch {}
  }, []);

  const loadQuota = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/gps/maps-stats");
      const data = await res.json();
      if (data.success) setQuota(data);
    } catch {}
  }, []);

  useEffect(() => {
    if (layers.heatmap && heatmapData.length === 0) loadHeatmap();
    if (layers.zones && zones.length === 0) loadZones();
  }, [layers.heatmap, layers.zones, heatmapData.length, zones.length, loadHeatmap, loadZones]);

  useEffect(() => {
    if (showQuota) loadQuota();
  }, [showQuota, loadQuota]);

  // ── Pedidos filtrados ──
  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (!q) return true;
      return (
        o.id.toLowerCase().includes(q) ||
        (o.customer.name || "").toLowerCase().includes(q) ||
        (o.business?.name || "").toLowerCase().includes(q) ||
        (o.driver?.name || "").toLowerCase().includes(q)
      );
    });
  }, [orders, statusFilter, search]);

  const clearOverlays = useCallback(() => {
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    linesRef.current.forEach((l) => l.setMap(null));
    linesRef.current = [];
  }, []);

  // ── Render de marcadores y rutas ──
  useEffect(() => {
    if (!mapsReady || !gmap.current) return;
    const google = (window as any).google;
    clearOverlays();

    const openInfo = (marker: any, html: string) => {
      infoWindowRef.current?.setContent(html);
      infoWindowRef.current?.open(gmap.current, marker);
    };

    // Negocios (con clustering por zoom)
    if (layers.businesses) {
      const clusters = clusterPoints(
        businesses.map((b) => ({ id: b.id, lat: b.lat, lng: b.lng, data: b })),
        zoom,
      );
      clusters.forEach((c) => {
        if (c.count === 1) {
          const b = c.items[0].data;
          const meta = businessMarkerMeta(b.type, b.categories);
          const m = new google.maps.Marker({
            position: { lat: b.lat, lng: b.lng },
            map: gmap.current,
            title: b.name,
            icon: asGoogleIcon(
              google,
              businessLabelIcon({
                iconKey: meta.icon,
                color: b.isPaused ? "#6B7280" : meta.color,
                title: b.name,
                subtitle: b.isPaused
                  ? "Pausado"
                  : b.isOpen
                    ? `Abierto · ${b.activeOrders} activos`
                    : "Cerrado",
              }),
            ),
            zIndex: 100,
          });
          m.addListener("click", () =>
            openInfo(
              m,
              `<div style="padding:8px;max-width:240px;font-family:system-ui">
                <strong>🏪 ${b.name}</strong><br/>
                <span>${b.address || "Sin dirección"}</span><br/>
                <span>${b.isPaused ? "⏸️ Pausado" : b.isOpen ? "✅ Abierto" : "🔴 Cerrado"} · ⭐ ${b.rating || "-"}</span><br/>
                <span>📦 ${b.activeOrders} pedidos activos · ${b.totalOrders} totales</span>
                ${b.phone ? `<br/><a href="tel:${b.phone}">📞 ${b.phone}</a>` : ""}
              </div>`,
            ),
          );
          markersRef.current.push(m);
        } else {
          const m = new google.maps.Marker({
            position: { lat: c.lat, lng: c.lng },
            map: gmap.current,
            title: `${c.count} negocios`,
            icon: {
              url: clusterSvg(c.count, "#7C3AED"),
              scaledSize: new google.maps.Size(44, 44),
            },
            zIndex: 60,
          });
          m.addListener("click", () => {
            gmap.current?.panTo({ lat: c.lat, lng: c.lng });
            gmap.current?.setZoom(Math.min(20, (gmap.current.getZoom() || zoom) + 2));
          });
          markersRef.current.push(m);
        }
      });
    }

    // Repartidores — marcadores PERSISTENTES y animados: no se recrean en
    // cada refresco, se deslizan hacia cada nueva posición (WS cada ~2 s)
    if (layers.drivers) {
      const validIds = new Set<string>();
      drivers.forEach((d) => {
        const vehicle = vehicleMarkerMeta(d.vehicleType);
        const color = d.isBlocked
          ? "#6B7280"
          : d.staleGps
            ? "#F59E0B"
            : d.isOnline
              ? "#10B981"
              : "#9CA3AF";
        validIds.add(d.id);
        const pos = { lat: d.lat, lng: d.lng };
        let m = driverMarkersRef.current[d.id];
        if (m) {
          animateMarkerTo(m, pos);
          m.setTitle(`${d.name} · ${d.isOnline ? "conectado" : "desconectado"}`);
          m.setIcon(asGoogleIcon(google, driverIcon(vehicle.icon, color)));
        } else {
          m = new google.maps.Marker({
            position: pos,
            map: gmap.current,
            title: `${d.name} · ${d.isOnline ? "conectado" : "desconectado"}`,
            icon: asGoogleIcon(google, driverIcon(vehicle.icon, color)),
            zIndex: 200,
          });
          const driver = d;
          m.addListener("click", () =>
            openInfo(
              m,
              `<div style="padding:8px;max-width:240px;font-family:system-ui">
                <strong>🛵 ${driver.name}</strong><br/>
                <span>${stateLabelOf(driver)}</span><br/>
                <span>${vehicleMarkerMeta(driver.vehicleType).label}${driver.vehiclePlate ? ` · ${driver.vehiclePlate}` : ""}</span><br/>
                <span>⭐ ${driver.rating || "-"} · ${driver.totalDeliveries} entregas</span>
                ${driver.activeOrderId ? `<br/><span>📦 Pedido ${fmtNum(driver.activeOrderId)}</span>` : "<br/><span>Sin pedido activo</span>"}
                ${driver.phone ? `<br/><a href="tel:${driver.phone}">📞 ${driver.phone}</a>` : ""}
              </div>`,
            ),
          );
          driverMarkersRef.current[d.id] = m;
        }
      });
      // Repartidores que desaparecieron: fuera del mapa
      Object.keys(driverMarkersRef.current).forEach((id) => {
        if (!validIds.has(id)) {
          driverMarkersRef.current[id].setMap(null);
          delete driverMarkersRef.current[id];
        }
      });
    } else {
      Object.values(driverMarkersRef.current).forEach((m: any) =>
        m.setMap(null),
      );
      driverMarkersRef.current = {};
    }

    // Pedidos: negocio origen + destino cliente + rutas
    if (layers.orders) {
      filteredOrders.forEach((o) => {
        const meta = statusMeta(o.status);
        const hasAlert = o.alerts.length > 0;

        if (o.customer.lat != null && o.customer.lng != null) {
          const m = new google.maps.Marker({
            position: { lat: o.customer.lat, lng: o.customer.lng },
            map: gmap.current,
            title: `Pedido ${fmtNum(o)} · ${meta.label}`,
            icon: asGoogleIcon(
              google,
              pinIcon(hasAlert ? "#DC2626" : CUSTOMER_MARKER.color, CUSTOMER_MARKER.icon),
            ),
            zIndex: hasAlert ? 300 : 80,
          });
          m.addListener("click", () => {
            setSelected(o);
            openInfo(
              m,
              `<div style="padding:8px;max-width:250px;font-family:system-ui">
                <strong>📦 Pedido ${fmtNum(o)}</strong><br/>
                <span style="color:${meta.color}">● ${meta.label}</span> · ${o.minutesActive ?? "?"} min<br/>
                <span>🏠 ${o.customer.name}</span><br/>
                <span>${o.customer.address || ""}</span><br/>
                <span>💰 ${euro(o.total)} · ${o.paymentMethod === "cash" ? "Efectivo" : "Digital"}</span>
                ${hasAlert ? `<br/><span style="color:#DC2626">⚠️ ${o.alerts.map((a) => a.message).join(" · ")}</span>` : ""}
                ${o.customer.phone ? `<br/><a href="tel:${o.customer.phone}">📞 ${o.customer.phone}</a>` : ""}
              </div>`,
            );
          });
          markersRef.current.push(m);
        }

        // Rutas reales por calles de la etapa actual (recogida o entrega).
        // SOLO geometría real: mientras carga o si falla, no se dibuja nada.
        if (layers.routes && o.driver?.lat != null && o.driver?.lng != null) {
          const leg = routePhaseForStatus(o.status);
          let dest: { lat: number; lng: number } | null = null;
          if (leg === "to_business" && o.business) {
            dest = { lat: o.business.lat, lng: o.business.lng };
          } else if (
            leg === "to_customer" &&
            o.customer.lat != null &&
            o.customer.lng != null
          ) {
            dest = { lat: o.customer.lat, lng: o.customer.lng };
          }

          if (dest) {
            const origin = { lat: o.driver.lat, lng: o.driver.lng };
            const cached = routeCacheRef.current[o.id];
            const moved =
              !cached ||
              cached.phase !== leg ||
              distanceMeters(
                { latitude: cached.point.lat, longitude: cached.point.lng },
                { latitude: origin.lat, longitude: origin.lng },
              ) > 120;

            const legColor = leg === "to_business" ? "#F59E0B" : "#10B981";
            const draw = (path: any[], color: string) => {
              const line = new google.maps.Polyline({
                path,
                geodesic: true,
                strokeColor: color,
                strokeOpacity: 0.9,
                strokeWeight: 4,
                map: gmap.current,
              });
              linesRef.current.push(line);
            };

            if (cached?.coords?.length && !moved) {
              draw(cached.coords, legColor);
            } else if (!routeFetchingRef.current.has(o.id)) {
              routeFetchingRef.current.add(o.id);
              // Bulk del admin por OSRM (gratis, rutas reales por calles):
              // la cuota de Google queda para los mapas de usuario final
              fetchRouteDirections(
                { latitude: origin.lat, longitude: origin.lng },
                { latitude: dest.lat, longitude: dest.lng },
                "driving",
                { provider: "osrm" },
              )
                .then((route) => {
                  if (route && route.coordinates.length >= 2) {
                    routeCacheRef.current[o.id] = {
                      point: origin,
                      phase: leg,
                      coords: route.coordinates.map((c) => ({
                        lat: c.latitude,
                        lng: c.longitude,
                      })),
                    };
                  }
                })
                .catch(() => {})
                .finally(() => routeFetchingRef.current.delete(o.id));
            }
          }
        }
      });

      // Limpiar caché de rutas de pedidos que ya no están activos
      const activeIds = new Set(filteredOrders.map((o) => o.id));
      Object.keys(routeCacheRef.current).forEach((id) => {
        if (!activeIds.has(id)) delete routeCacheRef.current[id];
      });
    }
  }, [
    mapsReady,
    filteredOrders,
    drivers,
    businesses,
    layers,
    zoom,
    clearOverlays,
  ]);

  // ── Capa de heatmap ──
  useEffect(() => {
    if (!mapsReady || !gmap.current) return;
    const google = (window as any).google;
    if (heatLayerRef.current) {
      heatLayerRef.current.setMap(null);
      heatLayerRef.current = null;
    }
    if (!layers.heatmap || heatmapData.length === 0) return;
    if (!google.maps.visualization) return;

    heatLayerRef.current = new google.maps.visualization.HeatmapLayer({
      data: heatmapData.map((p) => ({
        location: new google.maps.LatLng(p.latitude, p.longitude),
        weight: p.orderCount,
      })),
      radius: 32,
      opacity: 0.75,
      map: gmap.current,
    });
  }, [mapsReady, layers.heatmap, heatmapData]);

  // ── Capa de tráfico ──
  useEffect(() => {
    if (!mapsReady || !gmap.current) return;
    const google = (window as any).google;
    if (!trafficLayerRef.current) {
      trafficLayerRef.current = new google.maps.TrafficLayer();
    }
    trafficLayerRef.current.setMap(layers.traffic ? gmap.current : null);
  }, [mapsReady, layers.traffic]);

  // ── Capa de zonas de entrega ──
  useEffect(() => {
    if (!mapsReady || !gmap.current) return;
    const google = (window as any).google;
    zoneShapesRef.current.forEach((s) => s.setMap(null));
    zoneShapesRef.current = [];
    if (!layers.zones) return;

    zones.forEach((z: any) => {
      const lat = parseFloat(z.centerLatitude ?? z.center_latitude);
      const lng = parseFloat(z.centerLongitude ?? z.center_longitude);
      const radiusKm = parseFloat(z.radiusKm ?? z.radius_km) || 0;
      if (isNaN(lat) || isNaN(lng) || !radiusKm) return;
      const circle = new google.maps.Circle({
        center: { lat, lng },
        radius: radiusKm * 1000,
        strokeColor: "#7C3AED",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: "#7C3AED",
        fillOpacity: 0.08,
        map: gmap.current,
      });
      zoneShapesRef.current.push(circle);
    });
  }, [mapsReady, layers.zones, zones]);

  // ── Enfocar pedido seleccionado ──
  const focusOrder = useCallback((o: OpsOrder) => {
    setSelected(o);
    setNearbyDrivers(null);
    setActionMsg(null);
    if (!gmap.current) return;
    const google = (window as any).google;
    const bounds = new google.maps.LatLngBounds();
    let any = false;
    if (o.business) {
      bounds.extend({ lat: o.business.lat, lng: o.business.lng });
      any = true;
    }
    if (o.customer.lat != null && o.customer.lng != null) {
      bounds.extend({ lat: o.customer.lat, lng: o.customer.lng });
      any = true;
    }
    if (o.driver?.lat != null && o.driver?.lng != null) {
      bounds.extend({ lat: o.driver.lat, lng: o.driver.lng });
      any = true;
    }
    if (any) gmap.current.fitBounds(bounds, 90);
  }, []);

  // ── Acciones operativas ──
  const loadNearbyDrivers = useCallback(async (orderId: string) => {
    setNearbyDrivers([]);
    try {
      const res = await apiRequest(
        "GET",
        `/api/admin/ops/nearby-drivers?orderId=${orderId}`,
      );
      const data = await res.json();
      setNearbyDrivers(data.drivers || []);
    } catch {
      setNearbyDrivers([]);
      setActionMsg("No se pudieron cargar los repartidores cercanos");
    }
  }, []);

  const assignDriver = useCallback(
    async (orderId: string, driverId: string) => {
      setAssigning(true);
      setActionMsg(null);
      try {
        const res = await apiRequestRaw("POST", "/api/delivery/assign", {
          orderId,
          driverId,
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setActionMsg("✅ Repartidor asignado");
          setNearbyDrivers(null);
          refresh();
        } else {
          setActionMsg(data.error || "No se pudo asignar");
        }
      } catch (e: any) {
        setActionMsg(e?.message || "No se pudo asignar");
      } finally {
        setAssigning(false);
      }
    },
    [refresh],
  );

  const shareTracking = useCallback(async (orderId: string) => {
    try {
      const res = await apiRequest("POST", `/api/gps/tracking-token/${orderId}`);
      const data = await res.json();
      if (data.trackingUrl) {
        window.open(data.trackingUrl, "_blank");
      } else {
        setActionMsg("No se pudo generar el enlace de seguimiento");
      }
    } catch {
      setActionMsg("No se pudo generar el enlace de seguimiento");
    }
  }, []);

  // ── Estilos dependientes del tema ──
  const bg = isDark ? "#111" : "#f5f5f5";
  const card = isDark ? "#1e1e1e" : "#fff";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const bord = isDark ? "#333" : "#e0e0e0";

  const statusCounts = kpis?.byStatus || {};

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      {/* ── Sidebar de operaciones ── */}
      <View style={[s.sidebar, { backgroundColor: card, borderRightColor: bord }]}>
        <View style={[s.sideHeader, { borderBottomColor: bord }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: text }]}>Centro de operaciones</Text>
            <View style={s.liveRow}>
              <View
                style={[
                  s.liveDot,
                  { backgroundColor: socketConnected ? "#22C55E" : "#F59E0B" },
                ]}
              />
              <Text style={[s.caption, { color: sub }]}>
                {socketConnected ? "En vivo" : "Polling"}
                {updatedAt
                  ? ` · ${new Date(updatedAt).toLocaleTimeString("es-ES")}`
                  : ""}
              </Text>
            </View>
          </View>
          <Pressable onPress={refresh} style={s.iconBtn}>
            <Feather name="refresh-cw" size={16} color={ComeYaColors.primary} />
          </Pressable>
          <Pressable onPress={() => setShowQuota(!showQuota)} style={s.iconBtn}>
            <Feather name="activity" size={16} color={sub} />
          </Pressable>
        </View>

        {error && (
          <View style={[s.errorBar, { backgroundColor: "#DC262620" }]}>
            <Feather name="alert-circle" size={14} color="#DC2626" />
            <Text style={[s.caption, { color: "#DC2626", marginLeft: 6, flex: 1 }]}>
              {error}
            </Text>
          </View>
        )}

        {showQuota && quota && (
          <View style={[s.quotaBox, { borderColor: bord }]}>
            <Text style={[s.kpiLabel, { color: sub }]}>Google Maps API</Text>
            <Text style={[s.caption, { color: text }]}>
              Caché: {quota.cacheSize} · Key:{" "}
              {quota.apiKeyConfigured ? "configurada" : "sin configurar"}
            </Text>
            {Object.entries(quota.rateLimiters || {}).map(
              ([k, v]: [string, any]) => (
                <Text key={k} style={[s.caption, { color: sub }]}>
                  {k}: {v.used}/{v.limit} (quedan {v.remaining})
                </Text>
              ),
            )}
          </View>
        )}

        <ScrollView style={{ flex: 1 }}>
          {/* KPIs */}
          <View style={s.kpiGrid}>
            <Kpi
              label="Activos"
              value={kpis?.activeOrders ?? "-"}
              color="#3B82F6"
              card={card}
              bord={bord}
              text={text}
              sub={sub}
            />
            <Kpi
              label="Sin repartidor"
              value={kpis?.ordersWithoutDriver ?? "-"}
              color={kpis?.ordersWithoutDriver ? "#DC2626" : "#22C55E"}
              card={card}
              bord={bord}
              text={text}
              sub={sub}
            />
            <Kpi
              label="Repartidores"
              value={`${kpis?.drivers.online ?? 0}/${kpis?.drivers.total ?? 0}`}
              color="#10B981"
              card={card}
              bord={bord}
              text={text}
              sub={sub}
            />
            <Kpi
              label="Alertas"
              value={kpis?.alertCount ?? 0}
              color={kpis?.alertCount ? "#DC2626" : "#22C55E"}
              card={card}
              bord={bord}
              text={text}
              sub={sub}
            />
            <Kpi
              label="Ingresos hoy"
              value={euro(kpis?.revenueToday ?? 0)}
              color="#F59E0B"
              card={card}
              bord={bord}
              text={text}
              sub={sub}
            />
            <Kpi
              label="Tiempo medio"
              value={
                kpis?.avgDeliveryMinutes != null
                  ? `${kpis.avgDeliveryMinutes} min`
                  : "—"
              }
              color="#8B5CF6"
              card={card}
              bord={bord}
              text={text}
              sub={sub}
            />
          </View>

          {/* Capas */}
          <Text style={[s.sectionLabel, { color: sub }]}>Capas</Text>
          <View style={s.chipWrap}>
            {(
              [
                ["orders", "Pedidos"],
                ["drivers", "Repartidores"],
                ["businesses", "Negocios"],
                ["routes", "Rutas"],
                ["heatmap", "Zonas calientes"],
                ["zones", "Zonas reparto"],
                ["traffic", "Tráfico"],
              ] as [LayerKey, string][]
            ).map(([key, label]) => (
              <Pressable
                key={key}
                onPress={() => setLayers((p) => ({ ...p, [key]: !p[key] }))}
                style={[
                  s.chip,
                  {
                    backgroundColor: layers[key]
                      ? ComeYaColors.primary
                      : "transparent",
                    borderColor: layers[key] ? ComeYaColors.primary : bord,
                  },
                ]}
              >
                <Text
                  style={[
                    s.chipTxt,
                    { color: layers[key] ? "#fff" : sub },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Filtro por estado */}
          <Text style={[s.sectionLabel, { color: sub }]}>Estado</Text>
          <View style={s.chipWrap}>
            <Pressable
              onPress={() => setStatusFilter("all")}
              style={[
                s.chip,
                {
                  backgroundColor:
                    statusFilter === "all" ? ComeYaColors.primary : "transparent",
                  borderColor: statusFilter === "all" ? ComeYaColors.primary : bord,
                },
              ]}
            >
              <Text
                style={[
                  s.chipTxt,
                  { color: statusFilter === "all" ? "#fff" : sub },
                ]}
              >
                Todos ({orders.length})
              </Text>
            </Pressable>
            {Object.entries(statusCounts).map(([st, count]) => {
              const meta = statusMeta(st);
              const active = statusFilter === st;
              return (
                <Pressable
                  key={st}
                  onPress={() => setStatusFilter(active ? "all" : st)}
                  style={[
                    s.chip,
                    {
                      backgroundColor: active ? meta.color : "transparent",
                      borderColor: active ? meta.color : bord,
                    },
                  ]}
                >
                  <Text style={[s.chipTxt, { color: active ? "#fff" : sub }]}>
                    {meta.label} ({count})
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Búsqueda */}
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar pedido, cliente, negocio…"
            placeholderTextColor={sub}
            style={[
              s.search,
              { borderColor: bord, color: text, backgroundColor: bg },
            ]}
          />

          {/* Lista de pedidos */}
          {loading && !orders.length ? (
            <ActivityIndicator
              color={ComeYaColors.primary}
              style={{ marginTop: Spacing.lg }}
            />
          ) : filteredOrders.length === 0 ? (
            <Text style={[s.caption, { color: sub, padding: Spacing.md }]}>
              No hay pedidos que coincidan
            </Text>
          ) : (
            filteredOrders.map((o) => {
              const meta = statusMeta(o.status);
              const isSel = selected?.id === o.id;
              const hasAlert = o.alerts.length > 0;
              return (
                <Pressable
                  key={o.id}
                  onPress={() => focusOrder(o)}
                  style={[
                    s.orderRow,
                    {
                      borderBottomColor: bord,
                      backgroundColor: isSel
                        ? ComeYaColors.primary + "12"
                        : "transparent",
                      borderLeftWidth: 3,
                      borderLeftColor: hasAlert ? "#DC2626" : meta.color,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <View style={s.rowBetween}>
                      <Text style={[s.orderId, { color: text }]}>
                        {fmtNum(o)}
                      </Text>
                      <Text style={[s.caption, { color: meta.color }]}>
                        {meta.label}
                      </Text>
                    </View>
                    <Text style={[s.caption, { color: sub }]} numberOfLines={1}>
                      {o.business?.name || "Negocio"} → {o.customer.name}
                    </Text>
                    <View style={s.rowBetween}>
                      <Text style={[s.caption, { color: sub }]}>
                        {o.driver ? `🛵 ${o.driver.name}` : "Sin repartidor"}
                      </Text>
                      <Text
                        style={[
                          s.caption,
                          {
                            color:
                              (o.minutesActive ?? 0) > 30 ? "#DC2626" : sub,
                            fontWeight: "600",
                          },
                        ]}
                      >
                        {o.minutesActive ?? "?"} min · {euro(o.total)}
                      </Text>
                    </View>
                    {hasAlert && (
                      <Text style={[s.caption, { color: "#DC2626" }]}>
                        ⚠️ {o.alerts.map((a) => a.message).join(" · ")}
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* ── Mapa ── */}
      <View style={{ flex: 1 }}>
        <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
        {!mapsReady && (
          <View style={s.mapLoading}>
            <ActivityIndicator size="large" color={ComeYaColors.primary} />
          </View>
        )}

        {/* Ficha del pedido seleccionado */}
        {selected && (
          <View style={[s.detail, { backgroundColor: card, borderColor: bord }]}>
            <ScrollView>
              <View style={s.rowBetween}>
                <Text style={[s.title, { color: text }]}>
                  Pedido {fmtNum(selected)}
                </Text>
                <Pressable onPress={() => setSelected(null)} style={s.iconBtn}>
                  <Feather name="x" size={18} color={sub} />
                </Pressable>
              </View>

              <View
                style={[
                  s.statusPill,
                  { backgroundColor: statusMeta(selected.status).color },
                ]}
              >
                <Text style={s.statusPillTxt}>
                  {statusMeta(selected.status).label} · {selected.minutesActive ?? "?"} min
                </Text>
              </View>

              {selected.alerts.length > 0 && (
                <View style={[s.alertBox, { backgroundColor: "#DC262615" }]}>
                  {selected.alerts.map((a, i) => (
                    <Text key={i} style={[s.caption, { color: "#DC2626" }]}>
                      ⚠️ {a.message}
                    </Text>
                  ))}
                </View>
              )}

              <Text style={[s.sectionLabel, { color: sub }]}>Cliente</Text>
              <Text style={[s.detailTxt, { color: text }]}>
                {selected.customer.name}
              </Text>
              <Text style={[s.caption, { color: sub }]}>
                {selected.customer.address || "Sin dirección"}
              </Text>
              {selected.customer.phone && (
                <View style={s.actionRow}>
                  <ActionBtn
                    icon="phone"
                    label="Llamar"
                    onPress={() =>
                      window.open(`tel:${selected.customer.phone}`, "_self")
                    }
                    color="#10B981"
                  />
                  <ActionBtn
                    icon="message-circle"
                    label="WhatsApp"
                    onPress={() =>
                      window.open(
                        `https://wa.me/${(selected.customer.phone || "").replace(/\D/g, "")}`,
                        "_blank",
                      )
                    }
                    color="#25D366"
                  />
                </View>
              )}

              <Text style={[s.sectionLabel, { color: sub }]}>Negocio</Text>
              <Text style={[s.detailTxt, { color: text }]}>
                {selected.business?.name || "—"}
              </Text>
              {selected.business?.phone && (
                <View style={s.actionRow}>
                  <ActionBtn
                    icon="phone"
                    label="Llamar negocio"
                    onPress={() =>
                      window.open(`tel:${selected.business?.phone}`, "_self")
                    }
                    color="#3B82F6"
                  />
                </View>
              )}

              <Text style={[s.sectionLabel, { color: sub }]}>Repartidor</Text>
              {selected.driver ? (
                <>
                  <Text style={[s.detailTxt, { color: text }]}>
                    {selected.driver.name} · ⭐ {selected.driver.rating || "-"}
                  </Text>
                  <Text style={[s.caption, { color: sub }]}>
                    {vehicleMarkerMeta(selected.driver.vehicleType).label} · GPS{" "}
                    {selected.driver.lastUpdateMinutes != null
                      ? `hace ${selected.driver.lastUpdateMinutes} min`
                      : "sin datos"}
                  </Text>
                  <View style={s.actionRow}>
                    {selected.driver.phone && (
                      <ActionBtn
                        icon="phone"
                        label="Llamar"
                        onPress={() =>
                          window.open(`tel:${selected.driver?.phone}`, "_self")
                        }
                        color="#10B981"
                      />
                    )}
                    <ActionBtn
                      icon="repeat"
                      label="Reasignar"
                      onPress={() => loadNearbyDrivers(selected.id)}
                      color="#F59E0B"
                    />
                  </View>
                </>
              ) : (
                <>
                  <Text style={[s.caption, { color: "#DC2626" }]}>
                    Sin repartidor asignado
                  </Text>
                  <View style={s.actionRow}>
                    <ActionBtn
                      icon="user-plus"
                      label="Asignar repartidor"
                      onPress={() => loadNearbyDrivers(selected.id)}
                      color={ComeYaColors.primary}
                    />
                  </View>
                </>
              )}

              {nearbyDrivers && (
                <View style={[s.nearbyBox, { borderColor: bord }]}>
                  <Text style={[s.kpiLabel, { color: sub }]}>
                    Repartidores cercanos
                  </Text>
                  {nearbyDrivers.length === 0 ? (
                    <Text style={[s.caption, { color: sub }]}>
                      No hay repartidores disponibles
                    </Text>
                  ) : (
                    nearbyDrivers.map((d: any) => (
                      <Pressable
                        key={d.id}
                        disabled={assigning || d.isCurrent}
                        onPress={() => assignDriver(selected.id, d.id)}
                        style={[s.nearbyRow, { borderBottomColor: bord }]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[s.caption, { color: text, fontWeight: "600" }]}>
                            {d.name} {d.isCurrent ? "(actual)" : ""}
                          </Text>
                          <Text style={[s.caption, { color: sub }]}>
                            {d.isOnline ? "✅ conectado" : "⚪ desconectado"}
                            {d.distanceKm != null ? ` · ${d.distanceKm} km` : ""}
                            {d.busy ? " · ocupado" : ""}
                          </Text>
                        </View>
                        {!d.isCurrent && (
                          <Feather
                            name="chevron-right"
                            size={16}
                            color={ComeYaColors.primary}
                          />
                        )}
                      </Pressable>
                    ))
                  )}
                </View>
              )}

              <Text style={[s.sectionLabel, { color: sub }]}>Importe</Text>
              <Text style={[s.caption, { color: sub }]}>
                Subtotal {euro(selected.subtotal)} · Envío{" "}
                {euro(selected.deliveryFee)}
              </Text>
              <Text style={[s.detailTxt, { color: text }]}>
                Total {euro(selected.total)} ·{" "}
                {selected.paymentMethod === "cash" ? "Efectivo" : "Pagado digital"}
              </Text>

              <View style={s.actionRow}>
                <ActionBtn
                  icon="external-link"
                  label="Seguimiento público"
                  onPress={() => shareTracking(selected.id)}
                  color="#6366F1"
                />
              </View>

              {actionMsg && (
                <Text style={[s.caption, { color: text, marginTop: Spacing.sm }]}>
                  {actionMsg}
                </Text>
              )}
            </ScrollView>
          </View>
        )}

        {/* Leyenda */}
        <View style={[s.legend, { backgroundColor: card, borderColor: bord }]}>
          <LegendRow color="#7C3AED" label="Negocio" />
          <LegendRow color={CUSTOMER_MARKER.color} label="Cliente" />
          <LegendRow color="#10B981" label="Repartidor conectado" />
          <LegendRow color="#F59E0B" label="GPS sin señal / recogida" />
          <LegendRow color="#DC2626" label="Alerta" />
        </View>
      </View>
    </View>
  );
}

function Kpi({
  label,
  value,
  color,
  card,
  bord,
  text,
  sub,
}: {
  label: string;
  value: any;
  color: string;
  card: string;
  bord: string;
  text: string;
  sub: string;
}) {
  return (
    <View
      style={[
        s.kpiCard,
        { backgroundColor: card, borderColor: bord, borderLeftColor: color },
      ]}
    >
      <Text style={[s.kpiValue, { color: text }]}>{value}</Text>
      <Text style={[s.kpiLabel, { color: sub }]}>{label}</Text>
    </View>
  );
}

function ActionBtn({
  icon,
  label,
  onPress,
  color,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  color: string;
}) {
  return (
    <Pressable onPress={onPress} style={[s.actionBtn, { backgroundColor: color }]}>
      <Feather name={icon} size={13} color="#fff" />
      <Text style={s.actionTxt}>{label}</Text>
    </Pressable>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <View style={s.legendRow}>
      <View style={[s.legendDot, { backgroundColor: color }]} />
      <Text style={s.legendTxt}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "row" },
  sidebar: { width: 340, borderRightWidth: 1 },
  sideHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderBottomWidth: 1,
    gap: 4,
  },
  title: { fontSize: 16, fontWeight: "700" },
  caption: { fontSize: 11 },
  liveRow: { flexDirection: "row", alignItems: "center", marginTop: 2, gap: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  iconBtn: { padding: 7 },
  errorBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    margin: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  quotaBox: {
    margin: Spacing.sm,
    padding: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    gap: 2,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: Spacing.sm,
    gap: 6,
  },
  kpiCard: {
    width: "48%",
    padding: Spacing.sm,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderRadius: BorderRadius.sm,
  },
  kpiValue: { fontSize: 17, fontWeight: "700" },
  kpiLabel: { fontSize: 10, fontWeight: "600", textTransform: "uppercase" },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    paddingHorizontal: Spacing.sm,
    paddingTop: 6,
  },
  chip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipTxt: { fontSize: 11, fontWeight: "600" },
  search: {
    margin: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 7,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    fontSize: 12,
  },
  orderRow: {
    flexDirection: "row",
    padding: Spacing.sm,
    borderBottomWidth: 1,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderId: { fontSize: 12, fontWeight: "700" },
  mapLoading: {
    position: "absolute",
    inset: 0,
    justifyContent: "center",
    alignItems: "center",
  } as any,
  detail: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.md,
    width: 320,
    maxHeight: "82%",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  } as any,
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    marginTop: 6,
  },
  statusPillTxt: { color: "#fff", fontSize: 11, fontWeight: "700" },
  alertBox: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: 2,
  },
  detailTxt: { fontSize: 13, fontWeight: "600" },
  actionRow: { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: BorderRadius.sm,
  },
  actionTxt: { color: "#fff", fontSize: 11, fontWeight: "600" },
  nearbyBox: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
  },
  nearbyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  legend: {
    position: "absolute",
    bottom: Spacing.md,
    left: Spacing.md,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    gap: 3,
  } as any,
  legendRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendTxt: { fontSize: 10, color: "#888" },
});
