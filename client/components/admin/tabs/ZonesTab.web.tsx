import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ComeYaColors } from "../../../constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";

const PRIMARY = "#DC2626";

interface Zone {
  id: string;
  name: string;
  description?: string;
  deliveryFee: number;
  maxDeliveryTime: number;
  radiusKm: number;
  centerLatitude?: string;
  centerLongitude?: string;
  isActive: boolean;
  createdAt?: string;
}

interface Props {
  theme?: any;
  showToast?: (msg: string, type?: string) => void;
  onSelectZone?: (z: Zone) => void;
}

export const ZonesTab: React.FC<Props> = () => {
  const { isDark } = useTheme();
  const [zones, setZones]         = useState<Zone[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected]   = useState<Zone | null>(null);

  const bg     = isDark ? "#0d0d0d" : "#f2f3f5";
  const card   = isDark ? "#1a1a1a" : "#fff";
  const border = isDark ? "#2a2a2a" : "#ebebeb";
  const text   = isDark ? "#fff"    : "#111";
  const sub    = isDark ? "#666"    : "#aaa";

  const load = useCallback(async () => {
    try {
      const res  = await apiRequest("GET", "/api/admin/delivery-zones");
      const data = await res.json();
      setZones(data?.zones ?? []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fmt = (cents: number) =>
    isNaN(cents) ? "€0.00" : `€${(cents / 100).toFixed(2)}`;

  // ── Detail ────────────────────────────────────────────────────────────────
  if (selected) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={{ padding: 28 }}>
        <TouchableOpacity style={det.back} onPress={() => setSelected(null)}>
          <Feather name="arrow-left" size={15} color={PRIMARY} />
          <Text style={[det.backTxt, { color: PRIMARY }]}>Volver a zonas</Text>
        </TouchableOpacity>

        <View style={[det.card, { backgroundColor: card, borderColor: border }]}>
          {/* Header */}
          <View style={det.headerRow}>
            <View style={[det.iconWrap, { backgroundColor: PRIMARY + "15" }]}>
              <Feather name="map-pin" size={20} color={PRIMARY} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[det.zoneName, { color: text }]}>{selected.name}</Text>
              {selected.description && (
                <Text style={[det.zoneSub, { color: sub }]}>{selected.description}</Text>
              )}
            </View>
            <View style={[det.statusPill, { backgroundColor: selected.isActive ? "#10B98115" : "#EF444415", borderColor: selected.isActive ? "#10B981" : "#EF4444" }]}>
              <View style={[det.statusDot, { backgroundColor: selected.isActive ? "#10B981" : "#EF4444" }]} />
              <Text style={[det.statusTxt, { color: selected.isActive ? "#10B981" : "#EF4444" }]}>
                {selected.isActive ? "Activa" : "Inactiva"}
              </Text>
            </View>
          </View>

          <View style={[det.divider, { backgroundColor: border }]} />

          {/* Stats grid */}
          <View style={det.statsGrid}>
            {[
              { icon: "dollar-sign", label: "Tarifa de entrega", value: fmt(selected.deliveryFee),    color: "#10B981" },
              { icon: "clock",       label: "Tiempo máximo",     value: `${selected.maxDeliveryTime ?? 0} min`, color: "#F59E0B" },
              { icon: "circle",      label: "Radio de cobertura",value: `${selected.radiusKm ?? 0} km`,         color: "#3B82F6" },
              { icon: "map",         label: "Coordenadas",       value: selected.centerLatitude ? `${parseFloat(selected.centerLatitude).toFixed(4)}, ${parseFloat(selected.centerLongitude ?? "0").toFixed(4)}` : "No definidas", color: "#8B5CF6" },
            ].map(s => (
              <View key={s.label} style={[det.statCard, { backgroundColor: s.color + "10", borderColor: s.color + "20" }]}>
                <View style={[det.statIcon, { backgroundColor: s.color + "20" }]}>
                  <Feather name={s.icon as any} size={14} color={s.color} />
                </View>
                <Text style={[det.statVal, { color: s.color }]}>{s.value}</Text>
                <Text style={[det.statLabel, { color: sub }]}>{s.label}</Text>
              </View>
            ))}
          </View>

          {selected.createdAt && (
            <Text style={[det.created, { color: sub }]}>
              Creada el {new Date(selected.createdAt).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}
            </Text>
          )}
        </View>

        {/* Info banner */}
        <View style={[det.infoBanner, { backgroundColor: "#3B82F610", borderColor: "#3B82F630" }]}>
          <Feather name="info" size={14} color="#3B82F6" />
          <Text style={[det.infoTxt, { color: "#3B82F6" }]}>
            Las zonas de entrega definen las áreas donde ComeYa opera. La tarifa se aplica automáticamente al calcular el costo de envío para pedidos dentro del radio.
          </Text>
        </View>
      </ScrollView>
    );
  }

  // ── List ──────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* Header */}
      <View style={[li.header, { backgroundColor: card, borderBottomColor: border }]}>
        <View style={[li.headerIcon, { backgroundColor: PRIMARY + "15" }]}>
          <Feather name="map-pin" size={16} color={PRIMARY} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[li.headerTitle, { color: text }]}>Zonas de entrega</Text>
          <Text style={[li.headerSub, { color: sub }]}>{zones.length} zona{zones.length !== 1 ? "s" : ""} configurada{zones.length !== 1 ? "s" : ""}</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : zones.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 40 }}>
          <View style={[li.emptyIcon, { backgroundColor: PRIMARY + "10" }]}>
            <Feather name="map-pin" size={32} color={PRIMARY} />
          </View>
          <Text style={[li.emptyTitle, { color: text }]}>Sin zonas configuradas</Text>
          <Text style={[li.emptySub, { color: sub }]}>
            Las zonas de entrega permiten definir áreas con tarifas y tiempos específicos. Configúralas desde el backend.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={PRIMARY} />}
        >
          {zones.map(zone => (
            <TouchableOpacity
              key={zone.id}
              onPress={() => setSelected(zone)}
              style={[li.card, { backgroundColor: card, borderColor: border, borderLeftColor: zone.isActive ? "#10B981" : "#EF4444" }]}
            >
              <View style={li.cardTop}>
                <View style={[li.dot, { backgroundColor: zone.isActive ? "#10B981" : "#EF4444" }]} />
                <Text style={[li.zoneName, { color: text }]}>{zone.name}</Text>
                <View style={[li.statusPill, { backgroundColor: zone.isActive ? "#10B98115" : "#EF444415" }]}>
                  <Text style={[li.statusTxt, { color: zone.isActive ? "#10B981" : "#EF4444" }]}>
                    {zone.isActive ? "Activa" : "Inactiva"}
                  </Text>
                </View>
              </View>

              {zone.description && (
                <Text style={[li.desc, { color: sub }]} numberOfLines={1}>{zone.description}</Text>
              )}

              <View style={li.metaRow}>
                <View style={li.metaItem}>
                  <Feather name="dollar-sign" size={11} color="#10B981" />
                  <Text style={[li.metaTxt, { color: sub }]}>{fmt(zone.deliveryFee)}</Text>
                </View>
                <View style={li.metaItem}>
                  <Feather name="clock" size={11} color="#F59E0B" />
                  <Text style={[li.metaTxt, { color: sub }]}>{zone.maxDeliveryTime ?? 0} min</Text>
                </View>
                <View style={li.metaItem}>
                  <Feather name="circle" size={11} color="#3B82F6" />
                  <Text style={[li.metaTxt, { color: sub }]}>{zone.radiusKm ?? 0} km</Text>
                </View>
                <Feather name="chevron-right" size={14} color={sub} style={{ marginLeft: "auto" as any }} />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const li = StyleSheet.create({
  header:      { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  headerIcon:  { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 15, fontWeight: "700" },
  headerSub:   { fontSize: 11, marginTop: 1 },
  card:        { borderRadius: 14, padding: 16, borderWidth: 1, borderLeftWidth: 3 },
  cardTop:     { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  dot:         { width: 8, height: 8, borderRadius: 4 },
  zoneName:    { flex: 1, fontSize: 15, fontWeight: "700" },
  statusPill:  { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  statusTxt:   { fontSize: 11, fontWeight: "700" },
  desc:        { fontSize: 12, marginBottom: 10 },
  metaRow:     { flexDirection: "row", alignItems: "center", gap: 14 },
  metaItem:    { flexDirection: "row", alignItems: "center", gap: 4 },
  metaTxt:     { fontSize: 12 },
  emptyIcon:   { width: 72, height: 72, borderRadius: 36, justifyContent: "center", alignItems: "center" },
  emptyTitle:  { fontSize: 16, fontWeight: "700" },
  emptySub:    { fontSize: 13, textAlign: "center", lineHeight: 20 },
});

const det = StyleSheet.create({
  back:       { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 20 },
  backTxt:    { fontSize: 13, fontWeight: "700" },
  card:       { borderRadius: 16, padding: 24, borderWidth: 1, marginBottom: 16 },
  headerRow:  { flexDirection: "row", alignItems: "flex-start", gap: 14, marginBottom: 20 },
  iconWrap:   { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  zoneName:   { fontSize: 20, fontWeight: "800" },
  zoneSub:    { fontSize: 13, marginTop: 3 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  statusDot:  { width: 7, height: 7, borderRadius: 4 },
  statusTxt:  { fontSize: 12, fontWeight: "700" },
  divider:    { height: 1, marginBottom: 20 },
  statsGrid:  { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 },
  statCard:   { flex: 1, minWidth: 140, borderRadius: 12, padding: 14, borderWidth: 1, gap: 6 },
  statIcon:   { width: 28, height: 28, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  statVal:    { fontSize: 16, fontWeight: "800" },
  statLabel:  { fontSize: 11 },
  created:    { fontSize: 11, marginTop: 4 },
  infoBanner: { borderRadius: 12, padding: 14, borderWidth: 1, flexDirection: "row", gap: 10, alignItems: "flex-start" },
  infoTxt:    { flex: 1, fontSize: 12, lineHeight: 18 },
});
