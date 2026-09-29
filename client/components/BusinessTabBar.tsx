import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BottomTabBar } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ComeYaColors, Shadows } from "@/constants/theme";

const FAB_SIZE = 62;

/**
 * Barra inferior del negocio con el botón central de RESERVAS.
 *
 * El restaurante necesita confirmar las reservas en cuanto entran, así que
 * Reservas tiene que estar siempre a un toque y no escondida en "Gestión".
 * Se mantiene entera la barra estándar (ningún apartado desaparece) y encima
 * se dibuja un botón circular elevado, centrado sobre el borde superior.
 */
export function BusinessTabBar(props: BottomTabBarProps) {
  // Altura real de la barra (incluye el margen inferior del dispositivo):
  // se mide en vez de suponerla para que el botón quede centrado también en
  // iPhone con notch y en Android con navegación por gestos.
  const [barHeight, setBarHeight] = useState(0);

  return (
    <View>
      <View onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)}>
        <BottomTabBar {...props} />
      </View>

      {barHeight > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reservas"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            // `navigate` sube al RootStack: BusinessReservations no es un
            // tab, es una pantalla del stack raíz.
            props.navigation.navigate("BusinessReservations" as never);
          }}
          style={({ pressed }) => [
            styles.fab,
            {
              // Justo por encima de la barra: así no tapa ninguno de los
              // apartados (con 6 pestañas, un botón centrado a media altura
              // se comería los iconos de las dos del medio).
              bottom: barHeight + 6,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            },
          ]}
        >
          <Feather name="calendar" size={22} color="#FFFFFF" />
          <ThemedText style={styles.fabLabel}>Reservas</ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    alignSelf: "center",
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ComeYaColors.primary,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    ...Shadows.md,
  },
  fabLabel: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
    marginTop: 1,
  },
});
