import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface NumberPinProps {
  label: string | number;
  color?: string;
  size?: number;
}

/** Chincheta con número dentro (paradas de ruta optimizada). */
export function NumberPin({ label, color = "#DC2626", size = 36 }: NumberPinProps) {
  const text = String(label);
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
        <Text
          style={[
            styles.text,
            { fontSize: text.length > 1 ? size * 0.38 : size * 0.46 },
          ]}
          numberOfLines={1}
        >
          {text}
        </Text>
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
  text: {
    color: "#FFFFFF",
    fontWeight: "800",
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
});
