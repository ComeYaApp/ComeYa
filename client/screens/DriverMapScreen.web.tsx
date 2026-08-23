import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Text,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors } from "@/constants/theme";

const SORIA = { lat: 41.7636, lng: -2.4677 };
const GREEN = "#22C55E";
import { apiRequest } from "@/lib/query-client";
import {
  fetchRouteDirections,
  distanceMeters,
} from "@/utils/directions";
import {
  pinIcon,
  driverIcon,
  asGoogleIcon,
} from "@/utils/webMarkerSvg";
import { vehicleMarkerMeta, CUSTOMER_MARKER } from "@/utils/markerMeta";

function loadGoogleMaps(): Promise<void> {
  return new Promise(async (resolve, reject) => {
    if ((window as any).google?.maps) {
      resolve();
      return;
    }
    const existing = document.getElementById("gmap-script");
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
    script.id = "gmap-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

interface Props {
  orderId?: string; // si viene, centra el mapa en esa entrega
  destLat?: string;
  destLng?: string;
  onBack?: () => void; // volver al tab anterior
}

export default function DriverMapScreen({
  orderId,
  destLat,
  destLng,
  onBack,
}: Props) {
  const { theme, isDark } = useTheme();
  const mapRef = useRef<HTMLDivElement>(null);
  const gmap = useRef<any>(null);
  const driverMk = useRef<any>(null);
  const destMk = useRef<any>(null);
  const routeLine = useRef<any>(null);
  const watchId = useRef<number | null>(null);

  const [mapsReady, setMapsReady] = useState(false);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [eta, setEta] = useState<string | null>(null);
  const [distance, setDistance] = useState<string | null>(null);
  // Vehículo del repartidor (icono del mapa)
  const [driverVehicle, setDriverVehicle] = useState<string | null>(null);
  useEffect(() => {
    apiRequest("GET", "/api/users/profile/full")
      .then((r) => r.json())
      .then((d) => {
        if (d.vehicleType) setDriverVehicle(d.vehicleType);
      })
      .catch(() => {});
  }, []);

  const bg = isDark ? "#0d0d0d" : "#f2f3f5";
  const card = isDark ? "#1a1a1a" : "#fff";
  const text = isDark ? "#fff" : "#111";
  const sub = isDark ? "#666" : "#aaa";

  // ── Cargar Google Maps ──────────────────────────────────────────────────────
  useEffect(() => {
    loadGoogleMaps()
      .then(() => setMapsReady(true))
      .catch(console.error);
  }, []);

  // ── Calcular ETA simple (Haversine) ────────────────────────────────────────
  const calcEta = (dLat: number, dLng: number, oLat: number, oLng: number) => {
    const R = 6371;
    const dLatR = ((oLat - dLat) * Math.PI) / 180;
    const dLngR = ((oLng - dLng) * Math.PI) / 180;
    const a =
      Math.sin(dLatR / 2) ** 2 +
      Math.cos((dLat * Math.PI) / 180) *
        Math.cos((oLat * Math.PI) / 180) *
        Math.sin(dLngR / 2) ** 2;
    const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const mins = Math.round((km / 30) * 60); // 30 km/h promedio
    setDistance(`${km.toFixed(1)} km`);
    setEta(`~${mins} min`);
  };

  // ── Dibujar ruta real por calles entre dos puntos ─────────────────────────
  // Vía el proxy del servidor (Google Directions con fallback OSRM). Solo se
  // re-pide si el origen se movió >100 m; sin geometría, línea discontinua.
  const routeCoordsRef = useRef<{ lat: number; lng: number }[] | null>(null);
  const lastRouteFromRef = useRef<{ lat: number; lng: number } | null>(null);
  const drawRoute = useCallback(
    async (
      google: any,
      from: { lat: number; lng: number },
      to: { lat: number; lng: number },
    ) => {
      const shouldRefetch =
        !routeCoordsRef.current ||
        !lastRouteFromRef.current ||
        distanceMeters(
          {
            latitude: lastRouteFromRef.current.lat,
            longitude: lastRouteFromRef.current.lng,
          },
          { latitude: from.lat, longitude: from.lng },
        ) > 100;

      if (shouldRefetch) {
        lastRouteFromRef.current = from;
        const route = await fetchRouteDirections(
          { latitude: from.lat, longitude: from.lng },
          { latitude: to.lat, longitude: to.lng },
        );
        if (route && route.coordinates.length >= 2 && !route.fallback) {
          routeCoordsRef.current = route.coordinates.map((c) => ({
            lat: c.latitude,
            lng: c.longitude,
          }));
          if (route.distanceText) setDistance(route.distanceText);
          if (route.durationText) setEta(route.durationText);
        } else {
          routeCoordsRef.current = null;
        }
      }

      const hasRealRoute = !!routeCoordsRef.current;
      if (routeLine.current) routeLine.current.setMap(null);
      routeLine.current = new google.maps.Polyline({
        path: hasRealRoute ? routeCoordsRef.current! : [from, to],
        geodesic: true,
        strokeColor: ComeYaColors.primary,
        strokeOpacity: hasRealRoute ? 0.9 : 0,
        strokeWeight: 4,
        ...(hasRealRoute
          ? {}
          : {
              icons: [
                {
                  icon: {
                    path: "M 0,-1 0,1",
                    strokeOpacity: 0.7,
                    scale: 3,
                  },
                  offset: "0",
                  repeat: "16px",
                },
              ],
            }),
        map: gmap.current,
      });
      if (!hasRealRoute) calcEta(from.lat, from.lng, to.lat, to.lng);
    },
    [],
  );

  // ── Inicializar mapa ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapsReady || !mapRef.current || gmap.current) return;
    const google = (window as any).google;

    gmap.current = new google.maps.Map(mapRef.current, {
      center: SORIA,
      zoom: 15,
      disableDefaultUI: true,
      zoomControl: true,
      styles: isDark ? DARK_STYLE : [],
      gestureHandling: "greedy",
    });

    // ── GPS del repartidor ──
    let lastPostAt = 0;
    watchId.current = navigator.geolocation?.watchPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        gmap.current?.panTo(loc);

        if (driverMk.current) {
          driverMk.current.setPosition(loc);
        } else {
          driverMk.current = new google.maps.Marker({
            position: loc,
            map: gmap.current,
            icon: asGoogleIcon(
              google,
              driverIcon(
                vehicleMarkerMeta(driverVehicle).icon,
                ComeYaColors.primary,
              ),
            ),
            zIndex: 999,
            title: "Tu posición",
          });
        }

        // Actualizar ubicación en servidor (throttle 5s para no saturar
        // la BD ni el pipeline de tracking con cada fix del GPS)
        const now = Date.now();
        if (now - lastPostAt >= 5000) {
          lastPostAt = now;
          apiRequest("POST", "/api/delivery/location", {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }).catch(() => {});
        }

        // Redibujar ruta si hay destino
        if (destMk.current) {
          const dest = destMk.current.getPosition();
          drawRoute(google, loc, { lat: dest.lat(), lng: dest.lng() });
        }
      },
      undefined,
      { enableHighAccuracy: true, maximumAge: 5000 },
    ) as unknown as number;

    // ── Cargar pedido activo ──
    apiRequest("GET", "/api/delivery/active-order")
      .then((r) => r.json())
      .then((data) => {
        const order = data.order;
        if (!order) return;
        setActiveOrder(order);

        const lat = destLat
          ? parseFloat(destLat)
          : parseFloat(order.deliveryLatitude ?? "0");
        const lng = destLng
          ? parseFloat(destLng)
          : parseFloat(order.deliveryLongitude ?? "0");
        if (!lat || !lng) return;

        const destPos = { lat, lng };

        // Marker destino — casa azul
        if (destMk.current) destMk.current.setMap(null);
        destMk.current = new google.maps.Marker({
          position: destPos,
          map: gmap.current,
          title: "Destino de entrega",
          icon: asGoogleIcon(
            google,
            pinIcon(CUSTOMER_MARKER.color, CUSTOMER_MARKER.icon),
          ),
        });

        gmap.current?.panTo(destPos);
        gmap.current?.setZoom(15);

        // Dibujar ruta si ya tenemos ubicación del driver
        if (userLocation) drawRoute(google, userLocation, destPos);
      })
      .catch(() => {});

    return () => {
      if (watchId.current !== null)
        navigator.geolocation?.clearWatch(watchId.current);
    };
  }, [mapsReady, orderId, destLat, destLng]);

  const openGoogleMaps = () => {
    if (!activeOrder) return;
    const lat = destLat ?? activeOrder.deliveryLatitude;
    const lng = destLng ?? activeOrder.deliveryLongitude;
    if (lat && lng)
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
        "_blank",
      );
  };

  const centerOnMe = () => {
    if (userLocation) gmap.current?.panTo(userLocation);
  };

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      {/* ── Header ── */}
      <View
        style={[
          s.header,
          {
            backgroundColor: card,
            borderBottomColor: isDark ? "#222" : "#ebebeb",
          },
        ]}
      >
        {onBack && (
          <Pressable
            onPress={onBack}
            style={[
              s.headerBtn,
              { backgroundColor: isDark ? "#222" : "#f0f0f0" },
            ]}
          >
            <Feather name="arrow-left" size={18} color={text} />
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: text }]}>
            {activeOrder
              ? `Entrega → ${activeOrder.businessName}`
              : "Mi Mapa GPS"}
          </Text>
          {activeOrder && (
            <Text style={[s.headerSub, { color: sub }]} numberOfLines={1}>
              {activeOrder.deliveryAddress}
            </Text>
          )}
        </View>
        {/* ETA + distancia */}
        {eta && (
          <View style={[s.etaBadge, { backgroundColor: GREEN + "18" }]}>
            <Feather name="clock" size={12} color={GREEN} />
            <Text style={[s.etaTxt, { color: GREEN }]}>{eta}</Text>
            {distance && (
              <Text style={[s.etaTxt, { color: sub }]}> · {distance}</Text>
            )}
          </View>
        )}
      </View>

      {/* ── Mapa ── */}
      <View style={{ flex: 1, position: "relative" as any }}>
        <div ref={mapRef} style={{ position: "absolute", inset: 0 }} />

        {!mapsReady && (
          <View style={s.loading}>
            <ActivityIndicator size="large" color={GREEN} />
            <Text style={[s.loadingTxt, { color: sub }]}>
              Cargando mapa GPS...
            </Text>
          </View>
        )}

        {/* Botón centrar en mí */}
        <Pressable
          onPress={centerOnMe}
          style={[
            s.fab,
            {
              backgroundColor: card,
              bottom: activeOrder ? 160 : 24,
              right: 16,
            },
          ]}
        >
          <Feather name="crosshair" size={20} color={GREEN} />
        </Pressable>

        {/* Panel pedido activo */}
        {activeOrder && (
          <View
            style={[
              s.orderPanel,
              {
                backgroundColor: card,
                borderColor: isDark ? "#222" : "#ebebeb",
              },
            ]}
          >
            <View style={[s.orderStatus, { backgroundColor: GREEN + "18" }]}>
              <View style={[s.statusDot, { backgroundColor: GREEN }]} />
              <Text style={[s.orderStatusTxt, { color: GREEN }]}>
                Entrega activa
              </Text>
            </View>

            <View style={s.orderInfo}>
              <View style={{ flex: 1 }}>
                <Text style={[s.orderBusiness, { color: text }]}>
                  {activeOrder.businessName}
                </Text>
                <Text style={[s.orderAddr, { color: sub }]} numberOfLines={2}>
                  {activeOrder.deliveryAddress}
                </Text>
              </View>
              {eta && (
                <View style={s.orderEta}>
                  <Text style={[s.orderEtaVal, { color: GREEN }]}>{eta}</Text>
                  <Text style={[s.orderEtaLbl, { color: sub }]}>
                    {distance}
                  </Text>
                </View>
              )}
            </View>

            {/* Botones de acción */}
            <View style={s.orderActions}>
              <Pressable
                onPress={openGoogleMaps}
                style={[
                  s.actionBtn,
                  { backgroundColor: "#3B82F615", borderColor: "#3B82F630" },
                ]}
              >
                <Feather name="external-link" size={14} color="#3B82F6" />
                <Text style={[s.actionBtnTxt, { color: "#3B82F6" }]}>
                  Abrir en Google Maps
                </Text>
              </Pressable>
              <Pressable
                onPress={centerOnMe}
                style={[
                  s.actionBtn,
                  { backgroundColor: GREEN + "15", borderColor: GREEN + "30" },
                ]}
              >
                <Feather name="navigation" size={14} color="#22C55E" />
                <Text style={[s.actionBtnTxt, { color: "#22C55E" }]}>
                  Centrar en mí
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Sin pedido activo */}
        {mapsReady && !activeOrder && (
          <View
            style={[
              s.noOrderBanner,
              {
                backgroundColor: card,
                borderColor: isDark ? "#222" : "#ebebeb",
              },
            ]}
          >
            <Feather name="map-pin" size={16} color={sub} />
            <Text style={[s.noOrderTxt, { color: sub }]}>
              Sin entrega activa — tu posición GPS se actualiza en tiempo real
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
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

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 15, fontWeight: "700" },
  headerSub: { fontSize: 11, marginTop: 1 },
  etaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  etaTxt: { fontSize: 12, fontWeight: "700" },
  loading: {
    position: "absolute" as any,
    inset: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.85)",
    zIndex: 20,
  },
  loadingTxt: { fontSize: 13, marginTop: 10 },
  fab: {
    position: "absolute" as any,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
    zIndex: 10,
  },
  orderPanel: {
    position: "absolute" as any,
    left: 16,
    right: 16,
    bottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  orderStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginBottom: 10,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  orderStatusTxt: { fontSize: 11, fontWeight: "700" },
  orderInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  orderBusiness: { fontSize: 15, fontWeight: "700", marginBottom: 3 },
  orderAddr: { fontSize: 12, lineHeight: 17 },
  orderEta: { alignItems: "flex-end" },
  orderEtaVal: { fontSize: 18, fontWeight: "900" },
  orderEtaLbl: { fontSize: 11, marginTop: 2 },
  orderActions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnTxt: { fontSize: 12, fontWeight: "700" },
  noOrderBanner: {
    position: "absolute" as any,
    left: 16,
    right: 16,
    bottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    zIndex: 10,
  },
  noOrderTxt: { flex: 1, fontSize: 12 },
});
