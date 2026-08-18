import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet } from "react-native";
import { ComeYaColors } from "@/constants/theme";
import {
  pinIcon,
  driverIcon,
  asGoogleIcon,
} from "@/utils/webMarkerSvg";
import { vehicleMarkerMeta, ORDER_MARKER } from "@/utils/markerMeta";

interface Driver {
  id: string;
  name: string;
  vehicleType?: string;
  location?: {
    latitude: string;
    longitude: string;
  };
  activeOrder?: boolean;
}

interface Order {
  id: string;
  status: string;
  customer: {
    name: string;
  };
  deliveryAddress: {
    latitude?: string;
    longitude?: string;
  };
}

interface MapProps {
  activeOrders: Order[];
  onlineDrivers: Driver[];
  initialRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
}

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
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
}

export function NativeMap({ activeOrders, onlineDrivers, initialRegion }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const gmap = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [mapsReady, setMapsReady] = useState(false);

  const region = {
    latitude: initialRegion?.latitude || 41.7636,
    longitude: initialRegion?.longitude || -2.4677,
    latitudeDelta: initialRegion?.latitudeDelta || 0.05,
    longitudeDelta: initialRegion?.longitudeDelta || 0.05,
  };

  useEffect(() => {
    loadGoogleMaps()
      .then(() => setMapsReady(true))
      .catch(() => {});
  }, []);

  // Inicializar mapa
  useEffect(() => {
    if (!mapsReady || !mapRef.current) return;
    const google = (window as any).google;
    if (!google) return;

    gmap.current = new google.maps.Map(mapRef.current, {
      center: { lat: region.latitude, lng: region.longitude },
      zoom: 12,
      disableDefaultUI: true,
    });
  }, [mapsReady]);

  // Actualizar markers
  useEffect(() => {
    if (!gmap.current) return;
    const google = (window as any).google;
    if (!google) return;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const bounds = new google.maps.LatLngBounds();

    // Drivers — su vehículo
    onlineDrivers.forEach((driver) => {
      if (!driver.location?.latitude || !driver.location?.longitude) return;
      const lat = parseFloat(driver.location.latitude);
      const lng = parseFloat(driver.location.longitude);
      const marker = new google.maps.Marker({
        position: { lat, lng },
        map: gmap.current,
        title: driver.name,
        icon: asGoogleIcon(
          google,
          driverIcon(vehicleMarkerMeta(driver.vehicleType).icon),
        ),
      });
      markersRef.current.push(marker);
      bounds.extend(marker.getPosition()!);
    });

    // Orders — paquete
    activeOrders.forEach((order) => {
      if (!order.deliveryAddress?.latitude || !order.deliveryAddress?.longitude) return;
      const lat = parseFloat(order.deliveryAddress.latitude);
      const lng = parseFloat(order.deliveryAddress.longitude);
      const marker = new google.maps.Marker({
        position: { lat, lng },
        map: gmap.current,
        title: `Pedido ${order.id.slice(0, 8)}`,
        icon: asGoogleIcon(
          google,
          pinIcon(ORDER_MARKER.color, ORDER_MARKER.icon),
        ),
      });
      markersRef.current.push(marker);
      bounds.extend(marker.getPosition()!);
    });

    if (!bounds.isEmpty()) {
      gmap.current.fitBounds(bounds, 40);
    }
  }, [activeOrders, onlineDrivers]);

  return (
    <View style={styles.container}>
      <div
        ref={mapRef}
        style={{
          width: "100%",
          height: 250,
          borderRadius: 12,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 250,
    width: "100%",
  },
});