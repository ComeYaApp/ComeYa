import React from "react";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { StyleSheet } from "react-native";
import { ComeYaColors } from "@/constants/theme";

interface Driver {
  id: string;
  name: string;
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
        latitude: 7.7758,
        longitude: -104.3618,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }}
    >
      {onlineDrivers.map((driver) =>
        driver.location ? (
          <Marker
            key={`driver-${driver.id}`}
            coordinate={{
              latitude: parseFloat(driver.location.latitude),
              longitude: parseFloat(driver.location.longitude),
            }}
            title={driver.name}
            description={driver.activeOrder ? "En entrega" : "Disponible"}
            pinColor="#2196F3"
          />
        ) : null,
      )}
      {activeOrders.map((order) =>
        order.deliveryAddress?.latitude && order.deliveryAddress?.longitude ? (
          <Marker
            key={`order-${order.id}`}
            coordinate={{
              latitude: parseFloat(order.deliveryAddress.latitude),
              longitude: parseFloat(order.deliveryAddress.longitude),
            }}
            title={`Pedido ${order.id.slice(0, 8)}`}
            description={`${order.customer.name} - ${order.status}`}
            pinColor={ComeYaColors.primary}
          />
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
