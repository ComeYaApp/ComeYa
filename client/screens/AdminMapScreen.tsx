import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Linking,
  Alert,
} from "react-native";
import MapView, { PROVIDER_GOOGLE, Polyline } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { ComeYaColors, Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { apiRequest, apiRequestRaw } from "@/lib/query-client";
import { useAdminOps, type OpsOrder } from "@/hooks/useAdminOps";
import {
  isValidCoord,
  fetchRouteDirections,
  distanceMeters,
  type RouteCoordinate,
} from "@/utils/directions";
import { routePhaseForStatus } from "@/utils/routePhase";
import { displayOrderNumber } from "@/utils/orderNumber";
import { SmartMarker } from "@/components/map/SmartMarker";
import { MapPin } from "@/components/map/MapPin";
import { DriverPin } from "@/components/map/DriverPin";
import { BusinessPin as BusinessBubblePin } from "@/components/map/BusinessPin";
import {
  businessMarkerMeta,
  vehicleMarkerMeta,
  CUSTOMER_MARKER,
} from "@/utils/markerMeta";

const SORIA_REGION = {
  latitude: 41.7636,
  longitude: -2.4677,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "#F59E0B" },
  accepted: { label: "Aceptado", color: "#3B82F6" },
  preparing: { label: "Preparando", color: "#8B5CF6" },
  ready: { label: "Listo", color: "#10B981" },
  assigned_driver: { label: "Asignado", color: "#6366F1" },
  picked_up: { label: "Recogido", color: "#0EA5E9" },
  on_the_way: { label: "En camino", color: "#E60000" },
  in_transit: { label: "En tránsito", color: "#E60000" },
  arriving: { label: "Llegando", color: "#EC4899" },
};

const statusMeta = (s: string) =>
  STATUS_META[s] || { label: s, color: "#6B7280" };

const euro = (cents: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(
    (Number(cents) || 0) / 100,
  );

type Filter = "all" | "orders" | "drivers" | "businesses" | "alerts";

export default function AdminMapScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<OpsOrder | null>(null);
  const [nearby, setNearby] = useState<any[] | null>(null);
  const [assigning, setAssigning] = useState(false);
  // Ruta REAL por calles del pedido seleccionado (nunca línea recta)
  const [selectedRoute, setSelectedRoute] = useState<RouteCoordinate[]>([]);
  const lastSelRouteRef = useRef<{
    origin: RouteCoordinate;
    destKey: string;
  } | null>(null);
  const selRouteLoadingRef = useRef(false);

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

  const visibleOrders = useMemo(
    () => (filter === "alerts" ? orders.filter((o) => o.alerts.length > 0) : orders),
    [orders, filter],
  );

  const showOrders = filter === "all" || filter === "orders" || filter === "alerts";
  const showDrivers = filter === "all" || filter === "drivers";
  const showBusinesses = filter === "all" || filter === "businesses";

  // Ruta real por calles del pedido seleccionado: se pide al proxy (caché
  // 30 min + OSRM) solo cuando cambia el destino o el repartidor se movió
  // >150 m. Nunca se dibuja una línea recta de inventario.
  useEffect(() => {
    if (!selected?.driver) {
      setSelectedRoute([]);
      lastSelRouteRef.current = null;
      return;
    }
    const phase = routePhaseForStatus(selected.status);
    const origin = {
      latitude: selected.driver.lat,
      longitude: selected.driver.lng,
    };
    const dest =
      phase === "to_business" && selected.business
        ? { latitude: selected.business.lat, longitude: selected.business.lng }
        : phase === "to_customer" &&
            selected.customer.lat != null &&
            selected.customer.lng != null
          ? {
              latitude: selected.customer.lat,
              longitude: selected.customer.lng,
            }
          : null;

    if (
      !dest ||
      !isValidCoord(origin) ||
      !isValidCoord(dest as any) ||
      selRouteLoadingRef.current
    ) {
      if (!dest) setSelectedRoute([]);
      return;
    }

    const destKey = `${dest.latitude.toFixed(3)},${dest.longitude.toFixed(3)}`;
    const last = lastSelRouteRef.current;
    if (
      last &&
      last.destKey === destKey &&
      distanceMeters(last.origin, origin) < 150 &&
      selectedRoute.length >= 2
    ) {
      return; // aún válida
    }

    selRouteLoadingRef.current = true;
    fetchRouteDirections(origin, dest as any)
      .then((r) => {
        if (r && r.coordinates.length >= 2) {
          lastSelRouteRef.current = { origin, destKey };
          setSelectedRoute(r.coordinates);
        } else {
          setSelectedRoute([]);
        }
      })
      .catch(() => {})
      .finally(() => {
        selRouteLoadingRef.current = false;
      });
  }, [selected, selectedRoute.length]);

  const focusOrder = useCallback((o: OpsOrder) => {
    setSelected(o);
    setSelectedRoute([]);
    lastSelRouteRef.current = null;
    setNearby(null);
    const coords: { latitude: number; longitude: number }[] = [];
    if (o.business) {
      coords.push({ latitude: o.business.lat, longitude: o.business.lng });
    }
    if (o.customer.lat != null && o.customer.lng != null) {
      coords.push({ latitude: o.customer.lat, longitude: o.customer.lng });
    }
    if (o.driver?.lat != null && o.driver?.lng != null) {
      coords.push({ latitude: o.driver.lat, longitude: o.driver.lng });
    }
    if (coords.length && mapRef.current) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 120, right: 60, bottom: 320, left: 60 },
        animated: true,
      });
    }
  }, []);

  const loadNearby = useCallback(async (orderId: string) => {
    setNearby([]);
    try {
      const res = await apiRequest(
        "GET",
        `/api/admin/ops/nearby-drivers?orderId=${orderId}`,
      );
      const data = await res.json();
      setNearby(data.drivers || []);
    } catch {
      setNearby([]);
      Alert.alert("Error", "No se pudieron cargar los repartidores cercanos");
    }
  }, []);

  const assign = useCallback(
    async (orderId: string, driverId: string, driverName: string) => {
      setAssigning(true);
      try {
        const res = await apiRequestRaw("POST", "/api/delivery/assign", {
          orderId,
          driverId,
        });
        const data = await res.json();
        if (res.ok && data.success) {
          Alert.alert("Asignado", `${driverName} ahora lleva este pedido`);
          setNearby(null);
          refresh();
        } else {
          Alert.alert("Error", data.error || "No se pudo asignar");
        }
      } catch (e: any) {
        Alert.alert("Error", e?.message || "No se pudo asignar");
      } finally {
        setAssigning(false);
      }
    },
    [refresh],
  );

  if (loading && !orders.length && !error) {
    return (
      <View style={[s.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={ComeYaColors.primary} />
        <Text style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
          Cargando centro de operaciones...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        initialRegion={SORIA_REGION}
      >
        {/* Negocios */}
        {showBusinesses &&
          businesses
            .filter((b) => isValidCoord({ latitude: b.lat, longitude: b.lng }))
            .map((b) => {
            const meta = businessMarkerMeta(
              b.type ?? undefined,
              b.categories ?? undefined,
            );
            return (
              <SmartMarker
                key={`biz_${b.id}`}
                coordinate={{ latitude: b.lat, longitude: b.lng }}
                title={b.name}
                description={`${b.isPaused ? "Pausado" : b.isOpen ? "Abierto" : "Cerrado"} · ${b.activeOrders} pedidos activos`}
                anchor={{ x: 0.5, y: 1 }}
                trackKey={`biz_${b.id}_${b.isOpen}_${b.activeOrders}`}
              >
                <BusinessBubblePin
                  icon={meta.icon}
                  color={b.isPaused ? "#6B7280" : meta.color}
                  title={b.name}
                  compact
                />
              </SmartMarker>
            );
          })}

        {/* Pedidos: destino del cliente */}
        {showOrders &&
          visibleOrders.map((o) => {
            if (o.customer.lat == null || o.customer.lng == null) return null;
            const meta = statusMeta(o.status);
            const hasAlert = o.alerts.length > 0;
            return (
              <SmartMarker
                key={`ord_${o.id}`}
                coordinate={{
                  latitude: o.customer.lat,
                  longitude: o.customer.lng,
                }}
                title={`${displayOrderNumber(o)} · ${meta.label}`}
                description={`${o.customer.name} · ${euro(o.total)} · ${o.minutesActive ?? "?"} min`}
                anchor={{ x: 0.5, y: 1 }}
                onPress={() => focusOrder(o)}
                trackKey={`ord_${o.id}_${o.status}_${hasAlert}`}
              >
                <MapPin
                  icon={CUSTOMER_MARKER.icon}
                  color={hasAlert ? "#E60000" : meta.color}
                  size={34}
                />
              </SmartMarker>
            );
          })}

        {/* Repartidores */}
        {showDrivers &&
          drivers
            .filter((d) => isValidCoord({ latitude: d.lat, longitude: d.lng }))
            .map((d) => {
            const vehicle = vehicleMarkerMeta(d.vehicleType);
            const color = d.isBlocked
              ? "#6B7280"
              : d.staleGps
                ? "#F59E0B"
                : d.isOnline
                  ? ComeYaColors.success
                  : "#9CA3AF";
            return (
              <SmartMarker
                key={`drv_${d.id}`}
                coordinate={{ latitude: d.lat, longitude: d.lng }}
                title={d.name}
                description={`${vehicle.label} · ${
                  d.isBlocked
                    ? "Bloqueado"
                    : d.staleGps
                      ? `GPS hace ${d.lastUpdateMinutes ?? "?"} min`
                      : d.isOnline
                        ? "Conectado"
                        : "Desconectado"
                }`}
                anchor={{ x: 0.5, y: 0.5 }}
                trackKey={`drv_${d.id}_${d.isOnline}_${d.staleGps}`}
              >
                <DriverPin
                  vehicleIcon={vehicle.icon}
                  color={color}
                  pulse={d.isOnline && !d.staleGps}
                />
              </SmartMarker>
            );
          })}

        {/* Ruta REAL por calles del pedido seleccionado (etapa actual).
            Sin geometría no se dibuja nada — nunca líneas rectas. */}
        {(() => {
          const dlat = selected?.driver?.lat;
          const dlng = selected?.driver?.lng;
          if (!selected || dlat == null || dlng == null) return null;
          if (selectedRoute.length < 2) return null;

          const isPickup = routePhaseForStatus(selected.status) === "to_business";
          return (
            <Polyline
              coordinates={selectedRoute}
              strokeColor={isPickup ? "#F59E0B" : "#10B981"}
              strokeWidth={4}
            />
          );
        })()}
      </MapView>

      {/* Header con KPIs */}
      <View
        style={[
          s.header,
          { backgroundColor: theme.card, paddingTop: insets.top + 8 },
          Shadows.md,
        ]}
      >
        <View style={s.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: theme.text }]}>Operaciones</Text>
            <View style={s.liveRow}>
              <View
                style={[
                  s.liveDot,
                  { backgroundColor: socketConnected ? "#22C55E" : "#F59E0B" },
                ]}
              />
              <Text style={[s.caption, { color: theme.textSecondary }]}>
                {socketConnected ? "En vivo" : "Polling"}
                {updatedAt
                  ? ` · ${new Date(updatedAt).toLocaleTimeString("es-ES")}`
                  : ""}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={refresh} style={s.iconBtn}>
            <Feather name="refresh-cw" size={17} color={ComeYaColors.primary} />
          </TouchableOpacity>
        </View>

        {error ? (
          <Text style={[s.caption, { color: "#E60000", marginTop: 4 }]}>
            {error}
          </Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 6 }}
          >
            <KpiChip label="Activos" value={kpis?.activeOrders ?? "-"} color="#3B82F6" />
            <KpiChip
              label="Sin repartidor"
              value={kpis?.ordersWithoutDriver ?? "-"}
              color={kpis?.ordersWithoutDriver ? "#E60000" : "#22C55E"}
            />
            <KpiChip
              label="Repartidores"
              value={`${kpis?.drivers.online ?? 0}/${kpis?.drivers.total ?? 0}`}
              color="#10B981"
            />
            <KpiChip
              label="Alertas"
              value={kpis?.alertCount ?? 0}
              color={kpis?.alertCount ? "#E60000" : "#22C55E"}
            />
            <KpiChip
              label="Hoy"
              value={euro(kpis?.revenueToday ?? 0)}
              color="#F59E0B"
            />
            <KpiChip
              label="T. medio"
              value={
                kpis?.avgDeliveryMinutes != null
                  ? `${kpis.avgDeliveryMinutes}m`
                  : "—"
              }
              color="#8B5CF6"
            />
          </ScrollView>
        )}

        <View style={s.filterRow}>
          {(
            [
              ["all", "Todo"],
              ["orders", `Pedidos (${orders.length})`],
              ["drivers", `Repartidores (${drivers.length})`],
              ["businesses", `Negocios (${businesses.length})`],
              ["alerts", `Alertas (${kpis?.alertCount ?? 0})`],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              onPress={() => setFilter(key)}
              style={[
                s.filterBtn,
                {
                  backgroundColor:
                    filter === key ? ComeYaColors.primary : "transparent",
                  borderColor: filter === key ? ComeYaColors.primary : theme.border,
                },
              ]}
            >
              <Text
                style={[
                  s.filterTxt,
                  { color: filter === key ? "#fff" : theme.textSecondary },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Ficha del pedido seleccionado */}
      {selected && (
        <View
          style={[
            s.sheet,
            { backgroundColor: theme.card, paddingBottom: insets.bottom + 12 },
            Shadows.lg,
          ]}
        >
          <ScrollView>
            <View style={s.rowBetween}>
              <Text style={[s.title, { color: theme.text }]}>
                {displayOrderNumber(selected)}
              </Text>
              <TouchableOpacity onPress={() => setSelected(null)} style={s.iconBtn}>
                <Feather name="x" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
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

            {selected.alerts.map((a, i) => (
              <Text key={i} style={[s.caption, { color: "#E60000", marginTop: 4 }]}>
                ⚠️ {a.message}
              </Text>
            ))}

            <Text style={[s.detailTxt, { color: theme.text, marginTop: Spacing.sm }]}>
              🏪 {selected.business?.name || "—"} → 🏠 {selected.customer.name}
            </Text>
            <Text style={[s.caption, { color: theme.textSecondary }]}>
              {selected.customer.address || "Sin dirección"}
            </Text>
            <Text style={[s.detailTxt, { color: theme.text, marginTop: 4 }]}>
              {euro(selected.total)} ·{" "}
              {selected.paymentMethod === "cash" ? "Efectivo" : "Pagado digital"}
            </Text>

            {selected.driver ? (
              <Text style={[s.caption, { color: theme.textSecondary, marginTop: 4 }]}>
                🛵 {selected.driver.name} · GPS{" "}
                {selected.driver.lastUpdateMinutes != null
                  ? `hace ${selected.driver.lastUpdateMinutes} min`
                  : "sin datos"}
              </Text>
            ) : (
              <Text style={[s.caption, { color: "#E60000", marginTop: 4 }]}>
                Sin repartidor asignado
              </Text>
            )}

            <View style={s.actionRow}>
              {selected.customer.phone && (
                <ActionBtn
                  icon="phone"
                  label="Cliente"
                  color="#10B981"
                  onPress={() => Linking.openURL(`tel:${selected.customer.phone}`)}
                />
              )}
              {selected.driver?.phone && (
                <ActionBtn
                  icon="phone"
                  label="Repartidor"
                  color="#0EA5E9"
                  onPress={() => Linking.openURL(`tel:${selected.driver?.phone}`)}
                />
              )}
              {selected.business?.phone && (
                <ActionBtn
                  icon="phone"
                  label="Negocio"
                  color="#3B82F6"
                  onPress={() => Linking.openURL(`tel:${selected.business?.phone}`)}
                />
              )}
              <ActionBtn
                icon={selected.driver ? "repeat" : "user-plus"}
                label={selected.driver ? "Reasignar" : "Asignar"}
                color={ComeYaColors.primary}
                onPress={() => loadNearby(selected.id)}
              />
            </View>

            {nearby && (
              <View style={[s.nearbyBox, { borderColor: theme.border }]}>
                <Text style={[s.caption, { color: theme.textSecondary, fontWeight: "700" }]}>
                  REPARTIDORES CERCANOS
                </Text>
                {nearby.length === 0 ? (
                  <Text style={[s.caption, { color: theme.textSecondary }]}>
                    No hay repartidores disponibles
                  </Text>
                ) : (
                  nearby.map((d: any) => (
                    <TouchableOpacity
                      key={d.id}
                      disabled={assigning || d.isCurrent}
                      onPress={() => assign(selected.id, d.id, d.name)}
                      style={[s.nearbyRow, { borderBottomColor: theme.border }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[s.caption, { color: theme.text, fontWeight: "600" }]}>
                          {d.name} {d.isCurrent ? "(actual)" : ""}
                        </Text>
                        <Text style={[s.caption, { color: theme.textSecondary }]}>
                          {d.isOnline ? "Conectado" : "Desconectado"}
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
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {/* Lista rápida de alertas cuando no hay selección */}
      {!selected && (kpis?.alertCount ?? 0) > 0 && (
        <TouchableOpacity
          onPress={() => setFilter("alerts")}
          style={[s.alertBanner, { backgroundColor: "#E60000" }, Shadows.md]}
        >
          <Feather name="alert-triangle" size={15} color="#fff" />
          <Text style={s.alertBannerTxt}>
            {kpis?.alertCount} pedido(s) necesitan atención
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function KpiChip({
  label,
  value,
  color,
}: {
  label: string;
  value: any;
  color: string;
}) {
  return (
    <View style={[s.kpiChip, { borderLeftColor: color }]}>
      <Text style={[s.kpiValue, { color }]}>{value}</Text>
      <Text style={s.kpiLabel}>{label}</Text>
    </View>
  );
}

function ActionBtn({
  icon,
  label,
  color,
  onPress,
}: {
  icon: any;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={[s.actionBtn, { backgroundColor: color }]}>
      <Feather name={icon} size={13} color="#fff" />
      <Text style={s.actionTxt}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  headerTop: { flexDirection: "row", alignItems: "center" },
  title: { fontSize: 17, fontWeight: "700" },
  caption: { fontSize: 11 },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  iconBtn: { padding: 8 },
  kpiChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 6,
    borderLeftWidth: 3,
    backgroundColor: "rgba(128,128,128,0.08)",
    borderRadius: 6,
    minWidth: 74,
  },
  kpiValue: { fontSize: 14, fontWeight: "700" },
  kpiLabel: { fontSize: 9, color: "#888", textTransform: "uppercase" },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 8 },
  filterBtn: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterTxt: { fontSize: 11, fontWeight: "600" },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: "52%",
    padding: Spacing.md,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    marginTop: 4,
  },
  statusPillTxt: { color: "#fff", fontSize: 11, fontWeight: "700" },
  detailTxt: { fontSize: 13, fontWeight: "600" },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: Spacing.sm },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
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
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  alertBanner: {
    position: "absolute",
    bottom: Spacing.lg,
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 11,
    borderRadius: BorderRadius.md,
  },
  alertBannerTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },
});
