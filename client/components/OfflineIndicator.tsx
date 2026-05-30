import React from "react";
import { View, StyleSheet, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "./ThemedText";
import { useOffline } from "@/hooks/useOffline";
import { Spacing, ComeYaColors } from "@/constants/theme";

export function OfflineIndicator() {
  const { isOffline, isConnecting } = useOffline();
  const [visible, setVisible] = React.useState(false);
  const slideAnim = React.useRef(new Animated.Value(-100)).current;

  React.useEffect(() => {
    if (isOffline || isConnecting) {
      setVisible(true);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setVisible(false));
    }
  }, [isOffline, isConnecting]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: isConnecting
            ? ComeYaColors.warning
            : isOffline
              ? ComeYaColors.error
              : ComeYaColors.success,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <Feather
        name={isConnecting ? "refresh-cw" : isOffline ? "wifi-off" : "wifi"}
        size={16}
        color="#FFFFFF"
      />
      <ThemedText type="caption" style={styles.text}>
        {isConnecting
          ? "Reconectando..."
          : isOffline
            ? "Sin conexión - Modo offline"
            : "Conectado"}
      </ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
    zIndex: 9999,
  },
  text: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
