import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "./ThemedText";
import { Spacing, BorderRadius, ComeYaColors } from "@/constants/theme";
import { Feather } from "@expo/vector-icons";

interface OrderTransparencyInfoProps {
  status: string;
  estimatedTime?: string;
  driverName?: string;
  driverRating?: number;
  distance?: number;
}

export function OrderTransparencyInfo({
  status,
  estimatedTime,
  driverName,
  driverRating,
  distance,
}: OrderTransparencyInfoProps) {
  const getStatusMessage = () => {
    switch (status) {
      case "pending":
        return "Esperando confirmación del negocio";
      case "accepted":
        return "El negocio aceptó tu pedido";
      case "preparing":
        return "Preparando tu pedido";
      case "ready":
        return "Tu pedido está listo";
      case "assigned_driver":
        return "Repartidor asignado";
      case "picked_up":
      case "on_the_way":
      case "in_transit":
        return "En camino a tu ubicación";
      case "arriving":
        return "El repartidor está muy cerca";
      case "delivered":
        return "Pedido entregado";
      default:
        return "Procesando pedido";
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Feather name="info" size={20} color={ComeYaColors.primary} />
        <View style={styles.textContainer}>
          <ThemedText type="small" style={styles.label}>
            Estado actual
          </ThemedText>
          <ThemedText type="body" style={styles.value}>
            {getStatusMessage()}
          </ThemedText>
        </View>
      </View>

      {estimatedTime && (
        <View style={styles.row}>
          <Feather name="clock" size={20} color={ComeYaColors.primary} />
          <View style={styles.textContainer}>
            <ThemedText type="small" style={styles.label}>
              Tiempo estimado
            </ThemedText>
            <ThemedText type="body" style={styles.value}>
              {estimatedTime}
            </ThemedText>
          </View>
        </View>
      )}

      {driverName && (
        <View style={styles.row}>
          <Feather name="user" size={20} color={ComeYaColors.primary} />
          <View style={styles.textContainer}>
            <ThemedText type="small" style={styles.label}>
              Repartidor
            </ThemedText>
            <View style={styles.driverInfo}>
              <ThemedText type="body" style={styles.value}>
                {driverName}
              </ThemedText>
              {driverRating && (
                <View style={styles.rating}>
                  <Feather name="star" size={14} color={ComeYaColors.warning} />
                  <ThemedText type="small" style={styles.ratingText}>
                    {driverRating.toFixed(1)}
                  </ThemedText>
                </View>
              )}
            </View>
          </View>
        </View>
      )}

      {distance && (
        <View style={styles.row}>
          <Feather name="map-pin" size={20} color={ComeYaColors.primary} />
          <View style={styles.textContainer}>
            <ThemedText type="small" style={styles.label}>
              Distancia
            </ThemedText>
            <ThemedText type="body" style={styles.value}>
              {distance.toFixed(1)} km
            </ThemedText>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#F5F5F5",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginVertical: Spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  textContainer: {
    marginLeft: Spacing.sm,
    flex: 1,
  },
  label: {
    color: "#666",
    marginBottom: 2,
  },
  value: {
    color: "#000",
    fontWeight: "600",
  },
  driverInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  rating: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: Spacing.sm,
    backgroundColor: "#FFF",
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ratingText: {
    marginLeft: 4,
    color: "#000",
    fontWeight: "600",
  },
});
