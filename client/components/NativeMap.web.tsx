import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors } from "@/constants/theme";

const GOOGLE_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY || "";
const SORIA = { lat: 41.7636, lng: -2.4677 };

// SVG puro sin emojis
const DRIVER_SVG = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><circle cx="18" cy="18" r="16" fill="#10B981" stroke="white" stroke-width="2"/><path d="M10 20c0-2 1-3 2-4l4-2 3 2c2 1 3 2 3 4M13 22a2 2 0 104 0M21 22a2 2 0 104 0" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M13 18l2-4h5l2 3" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>')}`;
const ORDER_SVG = (color: string) =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="14" fill="${color}" stroke="white" stroke-width="2"/><path d="M10 12h12M12 12v-2a1 1 0 011-1h6a1 1 0 011 1v2M10 16h12l-1 6H11l-1-6z" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>`)}`;

function loadGoogleMaps(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.maps) {
      resolve();
      return;
    }
    const existing = document.getElementById("gmap-script");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }
    const script = document.createElement("script");
    script.id = "gmap-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

interface Driver {
  id: string;
  name: string;
  currentLatitude?: string;
  currentLongitude?: string;
}

interface Order {
  id: string;
  status: string;
  customer?: { name: string };
  deliveryLatitude?: string;
  deliveryLongitude?: string;
}

interface MapProps {
  activeOrders: Order[];
  onlineDrivers: Driver[];
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B",
  preparing: "#8B5CF6",
  on_the_way: "#10B981",
  ready: "#3B82F6",
};

export function NativeMap({ activeOrders, onlineDrivers }: MapProps) {
  const { theme, isDark } = useTheme();
  const mapRef = useRef<HTMLDivElement>(null);
  const gmap = useRef<any>(null);
  const driverMarkersRef = useRef<Map<string, any>>(new Map());
  const orderMarkersRef = useRef<Map<string, any>>(new Map());
  const [mapsReady, setMapsReady] = useState(false);

  // Inicializar mapa
  useEffect(() => {
    loadGoogleMaps()
      .then(() => setMapsReady(true))
      .catch(console.error);
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
  }, [mapsReady, isDark]);

  // Actualizar marcadores de repartidores
  useEffect(() => {
    if (!mapsReady || !gmap.current) return;
    const google = (window as any).google;

    // Eliminar markers de drivers que ya no están
    driverMarkersRef.current.forEach((marker, id) => {
      if (!onlineDrivers.find((d) => d.id === id)) {
        marker.setMap(null);
        driverMarkersRef.current.delete(id);
      }
    });

    onlineDrivers.forEach((driver) => {
      if (!driver.currentLatitude || !driver.currentLongitude) return;
      const pos = {
        lat: parseFloat(driver.currentLatitude),
        lng: parseFloat(driver.currentLongitude),
      };

      if (driverMarkersRef.current.has(driver.id)) {
        driverMarkersRef.current.get(driver.id).setPosition(pos);
      } else {
        const marker = new google.maps.Marker({
          position: pos,
          map: gmap.current,
          title: driver.name || "Repartidor",
          icon: {
            url: DRIVER_SVG,
            scaledSize: new google.maps.Size(36, 36),
            anchor: new google.maps.Point(18, 18),
          },
          zIndex: 999,
        });
        driverMarkersRef.current.set(driver.id, marker);
      }
    });
  }, [mapsReady, onlineDrivers]);

  // Actualizar marcadores de pedidos activos
  useEffect(() => {
    if (!mapsReady || !gmap.current) return;
    const google = (window as any).google;

    orderMarkersRef.current.forEach((marker, id) => {
      if (!activeOrders.find((o) => o.id === id)) {
        marker.setMap(null);
        orderMarkersRef.current.delete(id);
      }
    });

    activeOrders.forEach((order) => {
      if (!order.deliveryLatitude || !order.deliveryLongitude) return;
      const pos = {
        lat: parseFloat(order.deliveryLatitude),
        lng: parseFloat(order.deliveryLongitude),
      };
      const color = STATUS_COLORS[order.status] || "#9E9E9E";

      if (orderMarkersRef.current.has(order.id)) {
        orderMarkersRef.current.get(order.id).setPosition(pos);
      } else {
        const marker = new google.maps.Marker({
          position: pos,
          map: gmap.current,
          title: order.customer?.name || "Pedido",
          icon: {
            url: ORDER_SVG(color),
            scaledSize: new google.maps.Size(32, 32),
            anchor: new google.maps.Point(16, 16),
          },
          zIndex: 100,
        });
        orderMarkersRef.current.set(order.id, marker);
      }
    });
  }, [mapsReady, activeOrders]);

  return (
    <View style={[styles.container, { backgroundColor: theme.card }]}>
      <div
        ref={mapRef}
        style={
          {
            width: "100%",
            height: "100%",
            borderRadius: BorderRadius.lg,
          } as any
        }
      />

      {!mapsReady && (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={ComeYaColors.primary} />
        </View>
      )}

      {/* Leyenda */}
      <View style={[styles.legend, { backgroundColor: theme.card }]}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#10B981" }]} />
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            {onlineDrivers.filter((d) => d.currentLatitude).length} repartidores
          </ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#F59E0B" }]} />
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            {activeOrders.length} pedidos
          </ThemedText>
        </View>
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

const styles = StyleSheet.create({
  container: {
    height: 280,
    width: "100%",
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    position: "relative",
  } as any,
  loading: {
    position: "absolute",
    inset: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.85)",
    zIndex: 10,
  } as any,
  legend: {
    position: "absolute",
    bottom: Spacing.sm,
    left: Spacing.sm,
    flexDirection: "row",
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  } as any,
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
});
