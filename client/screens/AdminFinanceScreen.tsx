import React from "react";
import { View, StyleSheet } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { FinanceTab } from "@/components/admin/tabs/FinanceTab";
import { useToast } from "@/contexts/ToastContext";

export default function AdminFinanceScreen() {
  const { theme } = useTheme();
  const { showToast } = useToast();

  return (
    <View style={[s.container, { backgroundColor: theme.background }]}>
      <FinanceTab theme={theme} showToast={showToast} />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
});
