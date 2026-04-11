import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { ComeYaColors } from "../../../constants/theme";
import { AdminUser } from "../types/admin.types";
import { useTheme } from "@/hooks/useTheme";

interface UsersTabProps {
  users: AdminUser[];
  onUserPress: (user: AdminUser) => void;
}

export const UsersTab: React.FC<UsersTabProps> = ({ users, onUserPress }) => {
  const { theme } = useTheme();
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
      case "super_admin":
        return "#9333EA"; // Morado
      case "business":
      case "business_owner":
        return "#3B82F6"; // Azul
      case "driver":
      case "delivery_driver":
        return "#10B981"; // Verde
      case "customer":
        return "#6B7280"; // Gris
      default:
        return "#6B7280";
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      customer: "Cliente",
      business: "Negocio",
      business_owner: "Negocio",
      driver: "Repartidor",
      delivery_driver: "Repartidor",
      admin: "Administrador",
      super_admin: "Super Admin",
    };
    return labels[role] || role;
  };

  return (
    <ScrollView style={styles.container}>
      {users.map((user) => (
        <TouchableOpacity
          key={user.id}
          style={[styles.card, { backgroundColor: theme.card }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onUserPress(user);
          }}
        >
          <View style={styles.userHeader}>
            <Text style={[styles.userName, { color: theme.text }]}>{user.name}</Text>
            <View
              style={[
                styles.roleBadge,
                { backgroundColor: getRoleBadgeColor(user.role) },
              ]}
            >
              <Text style={styles.roleBadgeText}>{getRoleLabel(user.role)}</Text>
            </View>
          </View>
          <Text style={[styles.userPhone, { color: theme.textSecondary }]}>{user.phone}</Text>
          <Text style={[styles.userEmail, { color: theme.textSecondary }]}>{user.email || "Sin email"}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
  },
  userHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  userPhone: {
    fontSize: 14,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 12,
  },
});
