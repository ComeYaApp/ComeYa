import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface BusinessPinProps {
  /** Nombre de icono MaterialCommunityIcons según tipo de negocio (utils/markerMeta) */
  icon: string;
  color: string;
  title: string;
  subtitle?: string;
  selected?: boolean;
  compact?: boolean;
}

/**
 * Burbuja de negocio estilo Uber Eats: tarjeta blanca con círculo de color,
 * icono del tipo de comercio (pizza, sushi, mercado…) y nombre.
 */
export function BusinessPin({
  icon,
  color,
  title,
  subtitle,
  selected = false,
  compact = false,
}: BusinessPinProps) {
  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.bubble,
          compact && styles.bubbleCompact,
          selected && { borderColor: color, borderWidth: 2 },
        ]}
      >
        <View style={[styles.iconCircle, { backgroundColor: color }]}>
          <MaterialCommunityIcons
            name={icon as any}
            size={compact ? 13 : 15}
            color="#FFFFFF"
          />
        </View>
        <View style={styles.textCol}>
          <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={[styles.tail, { borderTopColor: "#FFFFFF" }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
  },
  bubble: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingLeft: 6,
    paddingRight: 12,
    paddingVertical: 6,
    maxWidth: 170,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  bubbleCompact: {
    paddingVertical: 4,
    paddingRight: 10,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  textCol: {
    marginLeft: 7,
    maxWidth: 130,
  },
  title: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1F2937",
  },
  titleCompact: {
    fontSize: 10,
  },
  subtitle: {
    fontSize: 9,
    color: "#6B7280",
    marginTop: 1,
  },
  tail: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 9,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginTop: -1,
  },
});
