import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, TextInput, Modal } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ComeYaColors, Spacing, BorderRadius } from "../../../constants/theme";
import { apiRequest } from "@/lib/query-client";

interface ZonesTabProps {
  theme: any;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
  onSelectZone?: (zone: DeliveryZone) => void;
}

interface DeliveryZone {
  id: string;
  name: string;
  description?: string;
  deliveryFee: number;
  maxDeliveryTime: number;
  centerLatitude?: string;
  centerLongitude?: string;
  radiusKm: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const ZonesTab: React.FC<ZonesTabProps> = ({ theme, showToast, onSelectZone }) => {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    loadZones();
  }, []);

  const loadZones = async () => {
    try {
      const res = await apiRequest("GET", "/api/admin/delivery-zones");
      const data = await res.json();
      setZones(data.zones || []);
    } catch (error) {
      showToast("Error al cargar zonas", "error");
    } finally {
      setLoading(false);
    }
  };



  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={ComeYaColors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView>
        {zones.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="map-pin" size={48} color={theme.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No hay zonas de entrega configuradas
            </Text>
            <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
              Las zonas de entrega permiten definir áreas con tarifas específicas
            </Text>
          </View>
        ) : (
          zones.map((zone) => (
            <Pressable key={zone.id} style={[styles.zoneCard, { backgroundColor: theme.card }]} onPress={() => onSelectZone?.(zone)}>
              <View style={styles.zoneHeader}>
                <Text style={[styles.zoneName, { color: theme.text }]}>{zone.name}</Text>
                <View style={[styles.badge, { backgroundColor: zone.isActive ? ComeYaColors.success + "20" : "#ccc" }]}>
                  <Text style={{ color: zone.isActive ? ComeYaColors.success : "#666", fontSize: 12 }}>
                    {zone.isActive ? "Activa" : "Inactiva"}
                  </Text>
                </View>
              </View>
              <View style={styles.zoneDetails}>
                <Text style={{ color: theme.textSecondary, fontSize: 14 }}>{zone.description || 'Sin descripción'}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 14 }}>Tarifa: €{isNaN(zone.deliveryFee) ? '0.00' : (zone.deliveryFee / 100).toFixed(2)}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 14 }}>Tiempo máximo: {isNaN(zone.maxDeliveryTime) ? '0' : zone.maxDeliveryTime} min</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 14 }}>Radio: {isNaN(zone.radiusKm) ? '0' : zone.radiusKm} km</Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },

  zoneCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  zoneHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  zoneName: {
    fontSize: 16,
    fontWeight: "600",
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  zoneDetails: {
    gap: 4,
    marginBottom: 12,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 32,
  },

});
