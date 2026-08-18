import React from "react";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";
import { StyleSheet } from "react-native";
import { ComeYaColors } from "@/constants/theme";
import { SmartMarker } from "@/components/map/SmartMarker";
import { MapPin } from "@/components/map/MapPin";
import { DriverPin } from "@/components/map/DriverPin";
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
}

export function NativeMap({ activeOrders, onlineDrivers }: MapProps) {
  return (
    <MapView
      style={styles.map}
      provider={PROVIDER_GOOGLE}
      initialRegion={{
        latitude: 41.7636, // Soria, España
        longitude: -2.4677,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }}
    >
      {onlineDrivers.map((driver) =>
        driver.location ? (
          <SmartMarker
            key={`driver-${driver.id}`}
            coordinate={{
              latitude: parseFloat(driver.location.latitude),
              longitude: parseFloat(driver.location.longitude),
            }}
            title={driver.name}
            description={driver.activeOrder ? "En entrega" : "Disponible"}
            anchor={{ x: 0.5, y: 0.5 }}
            trackKey={`nd_${driver.id}_${driver.vehicleType ?? ""}`}
          >
            <DriverPin
              vehicleIcon={vehicleMarkerMeta(driver.vehicleType).icon}
              color={ComeYaColors.success}
              size={38}
            />
          </SmartMarker>
        ) : null,
      )}
      {activeOrders.map((order) =>
        order.deliveryAddress?.latitude && order.deliveryAddress?.longitude ? (
          <SmartMarker
            key={`order-${order.id}`}
            coordinate={{
              latitude: parseFloat(order.deliveryAddress.latitude),
              longitude: parseFloat(order.deliveryAddress.longitude),
            }}
            title={`Pedido ${order.id.slice(0, 8)}`}
            description={`${order.customer.name} - ${order.status}`}
            anchor={{ x: 0.5, y: 1 }}
            trackKey={`no_${order.id}`}
          >
            <MapPin icon={ORDER_MARKER.icon} color={ORDER_MARKER.color} />
          </SmartMarker>
        ) : null,
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    height: 250,
    width: "100%",
  },
});
