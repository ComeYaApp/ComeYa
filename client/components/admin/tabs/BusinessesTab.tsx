import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { ComeYaColors } from "../../../constants/theme";
import { Business } from "../types/admin.types";
import { useTheme } from "@/hooks/useTheme";

interface BusinessesTabProps {
  businesses: Business[];
  onBusinessPress: (business: Business) => void;
}

export const BusinessesTab: React.FC<BusinessesTabProps> = ({
  businesses,
  onBusinessPress,
}) => {
  const { theme } = useTheme();
  
  return (
    <ScrollView style={styles.container}>
      {businesses.map((business) => (
        <TouchableOpacity
          key={business.id}
          style={[styles.card, { backgroundColor: theme.card }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onBusinessPress(business);
          }}
        >
          <View style={styles.businessHeader}>
            <Text style={[styles.businessName, { color: theme.text }]}>{business.name}</Text>
            <View style={[
              styles.statusBadge,
              { backgroundColor: business.isActive ? ComeYaColors.success : ComeYaColors.error }
            ]}>
              <Text style={styles.statusText}>
                {business.isActive ? 'Activo' : 'Inactivo'}
              </Text>
            </View>
          </View>
          <Text style={[styles.businessType, { color: theme.textSecondary }]}>{business.type === 'restaurant' ? 'Restaurante' : 'Mercado'}</Text>
          <Text style={[styles.businessAddress, { color: theme.textSecondary }]}>{business.address || 'Sin dirección'}</Text>
          <Text style={[styles.businessPhone, { color: theme.textSecondary }]}>{business.phone || 'Sin teléfono'}</Text>
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
  },
  businessHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  businessName: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  businessType: {
    fontSize: 14,
    marginBottom: 4,
  },
  businessAddress: {
    fontSize: 12,
    marginBottom: 4,
  },
  businessPhone: {
    fontSize: 12,
  },
});
