import React from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { PaymentProofsTab } from "@/components/admin/tabs/PaymentProofsTab";

/**
 * Pantalla de la pestaña inferior "Comprobantes": reutiliza la bandeja nativa
 * existente y añade el safe-area que la pestaña necesita.
 */
export default function AdminPaymentProofsScreen() {
  const { theme } = useTheme();
  return (
    <SafeAreaView
      style={[s.container, { backgroundColor: theme.backgroundRoot }]}
      edges={["top"]}
    >
      <PaymentProofsTab />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
});
