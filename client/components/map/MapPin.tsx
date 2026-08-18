import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface MapPinProps {
  /** Nombre de icono MaterialCommunityIcons (ver utils/markerMeta) */
  icon: string;
  color?: string;
  /** Diámetro del cuerpo del pin */
  size?: number;
  iconSize?: number;
  /** Etiqueta opcional debajo del pin (ETA, estado) */
  label?: string;
}

/** Chincheta clásica (círculo + punta) con icono vectorial blanco dentro. */
export function MapPin({
  icon,
  color = "#2563EB",
  size = 36,
  iconSize,
  label,
}: MapPinProps) {
  return (
    <View style={styles.container}>
      <View
        style={[
          styles.body,
          {
            backgroundColor: color,
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
      >
        <MaterialCommunityIcons
          name={icon as any}
          size={iconSize ?? Math.round(size * 0.55)}
          color="#FFFFFF"
        />
      </View>
      <View
        style={[
          styles.tip,
          {
            borderTopColor: color,
            borderLeftWidth: size * 0.22,
            borderRightWidth: size * 0.22,
            borderTopWidth: size * 0.32,
          },
        ]}
      />
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
  container: {
    alignItems: "center",
    justifyContent: "flex-end",
  },
  body: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 5,
  },
  tip: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginTop: -2,
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
