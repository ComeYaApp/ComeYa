import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";

interface DriverPinProps {
  /** Icono del vehículo (utils/markerMeta.vehicleMarkerMeta → icon) */
  vehicleIcon: string;
  /** Foto del repartidor; si existe se muestra dentro del círculo */
  photo?: string;
  color?: string;
  size?: number;
  /** Etiqueta opcional debajo (ETA, estado) */
  label?: string;
  pulse?: boolean;
  /** Mostrar el mini-badge del vehículo (por defecto sí) */
  showBadge?: boolean;
  /** Rumbo en grados (0-360): dibuja una flecha direccional que rota
   *  alrededor del círculo, estilo Uber/Glovo. La foto NO rota. */
  heading?: number;
}

/**
 * Marcador del repartidor estilo Uber: círculo verde con foto (o icono del
 * vehículo), anillo pulsante y mini-badge con el vehículo (bici/moto/coche).
 */
export function DriverPin({
  vehicleIcon,
  photo,
  color = "#10B981",
  size = 46,
  label,
  pulse = true,
  showBadge = true,
  heading,
}: DriverPinProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!pulse) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.35,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, pulseAnim]);

  const hasHeading =
    typeof heading === "number" && Number.isFinite(heading) && heading >= 0;

  return (
    <View style={styles.wrap}>
      <View style={{ width: size + 14, height: size + 14, alignItems: "center", justifyContent: "center" }}>
        {pulse && (
          <Animated.View
            style={[
              styles.ring,
              {
                borderColor: color,
                width: size + 8,
                height: size + 8,
                borderRadius: (size + 8) / 2,
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
        )}
        {/* Flecha direccional (rumbo): rota alrededor del círculo */}
        {hasHeading && (
          <View style={[styles.headingLayer, { width: size + 14, height: size + 14 }]}>
            <View style={{ transform: [{ rotate: `${heading}deg` }] }}>
              <View
                style={[
                  styles.nose,
                  { borderBottomColor: color },
                ]}
              />
            </View>
          </View>
        )}
        <View
          style={[
            styles.circle,
            {
              backgroundColor: color,
              width: size,
              height: size,
              borderRadius: size / 2,
            },
          ]}
        >
          {photo ? (
            <Image
              source={{ uri: photo }}
              style={{
                width: size - 6,
                height: size - 6,
                borderRadius: (size - 6) / 2,
              }}
              contentFit="cover"
              transition={150}
            />
          ) : (
            <MaterialCommunityIcons
              name={vehicleIcon as any}
              size={Math.round(size * 0.52)}
              color="#FFFFFF"
            />
          )}
        </View>
        {/* Mini-badge del vehículo */}
        {showBadge && (
          <View
            style={[
              styles.badge,
              {
                right: 2,
                bottom: 2,
                width: Math.round(size * 0.42),
                height: Math.round(size * 0.42),
                borderRadius: Math.round(size * 0.21),
              },
            ]}
          >
            <MaterialCommunityIcons
              name={vehicleIcon as any}
              size={Math.round(size * 0.26)}
              color={color}
            />
          </View>
        )}
      </View>
      {label ? (
        <View style={styles.labelPill}>
          <Text style={styles.labelText} numberOfLines={1}>
            {label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
  },
  ring: {
    position: "absolute",
    borderWidth: 2,
    opacity: 0.45,
  },
  headingLayer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  nose: {
    // Triángulo apuntando hacia arriba (0° = norte); el rotate del padre
    // lo orienta según el rumbo del movimiento.
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  circle: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 6,
  },
  badge: {
    position: "absolute",
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  labelPill: {
    marginTop: 3,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  labelText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#1F2937",
  },
});
