import React, { useState, useEffect } from "react";
import { View, StyleSheet, ActivityIndicator, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, ComeYaColors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import type { Driver, TabProps } from "../types/admin.types";

interface DriversTabProps {
  drivers: Driver[];
  onDriverPress: (driver: Driver) => void;
}

export const DriversTab: React.FC<DriversTabProps> = ({ drivers, onDriverPress }) => {
  return (
    <View style={styles.container}>
      {drivers.map((driver) => (
        <Pressable
          key={driver.id}
          style={styles.card}
          onPress={() => onDriverPress(driver)}
        >
          <View style={styles.driverHeader}>
            <ThemedText style={styles.driverName}>{driver.name}</ThemedText>
            <View style={[
              styles.statusBadge,
              { backgroundColor: driver.isOnline ? '#10B981' : '#6B7280' }
            ]}>
              <ThemedText style={styles.statusText}>
                {driver.isOnline ? 'En Línea' : 'Desconectado'}
              </ThemedText>
            </View>
          </View>
          <ThemedText style={styles.driverEmail}>{driver.email}</ThemedText>
          <ThemedText style={styles.driverPhone}>{driver.phone || 'Sin teléfono'}</ThemedText>
          <View style={styles.statsRow}>
            <ThemedText style={styles.statText}>Entregas: {driver.totalDeliveries}</ThemedText>
            <ThemedText style={styles.statText}>Rating: {driver.rating?.toFixed(1) || 'N/A'}</ThemedText>
            <ThemedText style={[styles.statText, { color: driver.strikes > 0 ? '#EF4444' : '#666' }]}>Strikes: {driver.strikes}</ThemedText>
          </View>
        </Pressable>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  driverHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  driverName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
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
  driverEmail: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 4,
  },
  driverPhone: {
    fontSize: 12,
    color: "#666666",
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statText: {
    fontSize: 12,
    color: "#666666",
  },
});
