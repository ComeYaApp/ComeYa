import React from "react";
import { View, StyleSheet } from "react-native";
import UniversalWallet from "../components/UniversalWallet";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { WebLayout } from "@/components/WebLayout";

export default function WalletScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();

  const showWithdrawals = user?.role === "delivery_driver" || user?.role === "business_owner";
  const showConnectSetup = user?.role === "delivery_driver" || user?.role === "business_owner";

  return (
    <WebLayout>
      <View style={[s.container, { backgroundColor: theme.backgroundRoot }]}>
        <UniversalWallet showWithdrawals={showWithdrawals} showConnectSetup={showConnectSetup} />
      </View>
    </WebLayout>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
});
