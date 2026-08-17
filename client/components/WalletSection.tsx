import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { API_CONFIG } from "../constants/config";

interface WalletData {
  balance: number;
  pendingBalance: number;
  totalEarned: number;
  totalWithdrawn: number;
  cashOwed: number;
  availableForWithdrawal: number;
}

interface WalletSectionProps {
  onNavigateToWallet?: () => void;
  compact?: boolean;
}

export default function WalletSection({
  onNavigateToWallet,
  compact = false,
}: WalletSectionProps) {
  const { user, token } = useAuth();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/wallet/balance`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        setWallet(data);
      }
    } catch (error) {
      console.error("Error fetching wallet:", error);
    } finally {
      setLoading(false);
    }
  };

  const getBalanceColor = () => {
    if (!wallet) return "#6B7280";
    const available = wallet.availableForWithdrawal;
    if (available >= 10000) return "#10B981";
    if (available >= 5000) return "#F59E0B";
    return "#6B7280";
  };

  if (loading) {
    return (
      <View style={[styles.container, compact && styles.containerCompact]}>
        <ActivityIndicator size="small" color="#FF6B35" />
      </View>
    );
  }

  if (compact) {
    return (
      <TouchableOpacity
        style={styles.compactContainer}
        onPress={onNavigateToWallet}
      >
        <View style={styles.compactHeader}>
          <Ionicons name="wallet-outline" size={20} color="#FF6B35" />
          <Text style={styles.compactTitle}>Mi Wallet</Text>
        </View>
        <Text style={[styles.compactAmount, { color: getBalanceColor() }]}>
          ${wallet ? (wallet.availableForWithdrawal / 100).toFixed(2) : "0.00"}
        </Text>
        <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="wallet-outline" size={24} color="#FF6B35" />
          <Text style={styles.title}>Mi Wallet</Text>
        </View>
        {onNavigateToWallet && (
          <TouchableOpacity onPress={onNavigateToWallet}>
            <Text style={styles.viewAllText}>Ver todo</Text>
          </TouchableOpacity>
        )}
      </View>

      {wallet && (
        <View
          style={[styles.balanceCard, { borderLeftColor: getBalanceColor() }]}
        >
          <Text style={styles.balanceLabel}>Saldo Disponible</Text>
          <Text style={[styles.balanceAmount, { color: getBalanceColor() }]}>
            ${(wallet.availableForWithdrawal / 100).toFixed(2)} €
          </Text>

          {wallet.cashOwed > 0 && (
            <View style={styles.warningBanner}>
              <Ionicons name="warning-outline" size={14} color="#F59E0B" />
              <Text style={styles.warningText}>
                Efectivo pendiente: ${(wallet.cashOwed / 100).toFixed(2)}
              </Text>
            </View>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Ganado</Text>
              <Text style={styles.statValue}>
                ${(wallet.totalEarned / 100).toFixed(0)}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Retirado</Text>
              <Text style={styles.statValue}>
                ${(wallet.totalWithdrawn / 100).toFixed(0)}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Pendiente</Text>
              <Text style={styles.statValue}>
                ${(wallet.pendingBalance / 100).toFixed(0)}
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  containerCompact: {
    padding: 12,
  },
  compactContainer: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  compactHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  compactTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginLeft: 8,
  },
  compactAmount: {
    fontSize: 18,
    fontWeight: "bold",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginLeft: 8,
  },
  viewAllText: {
    fontSize: 14,
    color: "#FF6B35",
    fontWeight: "500",
  },
  balanceCard: {
    borderLeftWidth: 4,
    paddingLeft: 16,
  },
  balanceLabel: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 12,
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  warningText: {
    fontSize: 11,
    color: "#92400E",
    marginLeft: 4,
    fontWeight: "500",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statItem: {
    alignItems: "center",
  },
  statLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
});
