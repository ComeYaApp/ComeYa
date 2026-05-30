import React, { useEffect } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { ThemedText } from "@/components/ThemedText";
import { ComeYaColors } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

export default function PaymentWebViewScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute() as any;
  const { theme } = useTheme();
  const { paymentUrl } = route.params || {};

  useEffect(() => {
    if (!paymentUrl) {
      navigation.goBack();
      return;
    }
    // En web, abrir directamente en nueva pestaña
    window.open(paymentUrl, "_blank");
    // Volver al inicio después de abrir
    setTimeout(() => {
      navigation.reset({ index: 0, routes: [{ name: "Main" }] });
    }, 1000);
  }, []);

  return (
    <View style={[s.container, { backgroundColor: theme.backgroundRoot }]}>
      <ActivityIndicator size="large" color={ComeYaColors.primary} />
      <ThemedText
        type="body"
        style={{ marginTop: 16, color: theme.textSecondary }}
      >
        Abriendo pasarela de pago...
      </ThemedText>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
});
