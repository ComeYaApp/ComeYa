import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest, getApiErrorMessage } from "@/lib/query-client";
import { BorderRadius, Spacing } from "@/constants/theme";

const STATUS_META: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  healthy: { label: "Sistema saludable", color: "#10B981", icon: "check-circle" },
  degraded: { label: "Sistema degradado", color: "#F59E0B", icon: "alert-triangle" },
  unhealthy: { label: "Sistema con fallas", color: "#EF4444", icon: "alert-circle" },
};

function formatUptime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

export function SystemHealthTab() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/admin/system/health");
      const json = await res.json();
      if (json.success) {
        setData(json);
        setError(null);
        setLastUpdated(new Date());
      } else {
        setError(json.error ?? "No se pudo leer el estado");
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudo leer el estado del sistema"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  if (loading && !data) {
    return (
      <View style={[s.center, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color="#E60000" />
      </View>
    );
  }

  const meta = STATUS_META[data?.status as string] ?? STATUS_META.degraded;

  return (
    <View style={[s.root, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[
          s.content,
          { paddingBottom: insets.bottom + 32 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor="#E60000"
          />
        }
      >
        <View
          style={[
            s.banner,
            { backgroundColor: meta.color + "14", borderColor: meta.color + "44" },
          ]}
        >
          <Feather name={meta.icon as any} size={22} color={meta.color} />
          <View style={{ flex: 1 }}>
            <Text style={[s.bannerTitle, { color: meta.color }]}>
              {meta.label}
            </Text>
            <Text style={[s.bannerSub, { color: theme.textSecondary }]}>
              {lastUpdated
                ? `Actualizado ${lastUpdated.toLocaleTimeString("es-ES")}`
                : "Sin actualizar"}
              {data?.timestamp
                ? ` · ${new Date(data.timestamp).toLocaleString("es-ES")}`
                : ""}
            </Text>
          </View>
        </View>

        {error && (
          <View style={[s.errorBox, { borderColor: "#EF444455" }]}>
            <Feather name="alert-circle" size={14} color="#EF4444" />
            <Text style={{ color: "#EF4444", fontSize: 12, flex: 1 }}>
              {error}
            </Text>
          </View>
        )}

        <View style={s.grid}>
          <Card
            title="Base de datos"
            icon="database"
            color={data?.database?.connected ? "#10B981" : "#EF4444"}
            value={
              data?.database?.connected
                ? `${data.database.latencyMs ?? "—"} ms`
                : "Sin conexión"
            }
            detail={data?.database?.connected ? "Conectada" : "Revisar MySQL"}
            theme={theme}
          />
          <Card
            title="Uptime"
            icon="clock"
            color="#3B82F6"
            value={formatUptime(data?.app?.uptimeSeconds)}
            detail={`Node ${data?.app?.node ?? "—"}`}
            theme={theme}
          />
          <Card
            title="Memoria"
            icon="cpu"
            color="#8B5CF6"
            value={`${data?.memory?.rssMb ?? 0} MB`}
            detail={`Heap ${data?.memory?.heapUsedMb ?? 0}/${data?.memory?.heapTotalMb ?? 0} MB`}
            theme={theme}
          />
          <Card
            title="Socket.io"
            icon="radio"
            color={data?.socket?.initialized ? "#10B981" : "#F59E0B"}
            value={`${data?.socket?.clients ?? 0} clientes`}
            detail={`${data?.socket?.adminClients ?? 0} admins conectados`}
            theme={theme}
          />
          <Card
            title="Entorno"
            icon="settings"
            color="#00BCD4"
            value={data?.app?.environment ?? "—"}
            detail={`Versión ${data?.app?.version ?? "—"}`}
            theme={theme}
          />
          <Card
            title="Jobs de fondo"
            icon="refresh-cw"
            color={data?.app?.backgroundJobsDisabled ? "#F59E0B" : "#10B981"}
            value={
              data?.app?.backgroundJobsDisabled ? "Desactivados" : "Activos"
            }
            detail="Cron y procesos"
            theme={theme}
          />
        </View>

        <Text style={[s.sectionTitle, { color: theme.textSecondary }]}>
          SERVICIOS CONFIGURADOS
        </Text>
        <View style={s.servicesWrap}>
          {Object.entries(data?.services ?? {}).map(([key, ok]) => (
            <View
              key={key}
              style={[
                s.serviceChip,
                {
                  backgroundColor: ok ? "#10B98112" : "#F59E0B12",
                  borderColor: ok ? "#10B98144" : "#F59E0B44",
                },
              ]}
            >
              <Feather
                name={ok ? "check-circle" : "alert-circle"}
                size={12}
                color={ok ? "#10B981" : "#F59E0B"}
              />
              <Text
                style={{
                  color: ok ? "#10B981" : "#F59E0B",
                  fontSize: 11,
                  fontWeight: "600",
                }}
              >
                {key}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function Card({ title, icon, color, value, detail, theme }: any) {
  return (
    <View
      style={[
        s.card,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <View style={[s.cardIcon, { backgroundColor: color + "18" }]}>
        <Feather name={icon} size={16} color={color} />
      </View>
      <Text style={[s.cardTitle, { color: theme.textSecondary }]}>{title}</Text>
      <Text style={[s.cardValue, { color }]}>{value}</Text>
      <Text style={[s.cardDetail, { color: theme.textSecondary }]}>
        {detail}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: 14,
  },
  bannerTitle: { fontSize: 15, fontWeight: "800" },
  bannerSub: { fontSize: 11, marginTop: 2 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: 16,
  },
  card: {
    flexGrow: 1,
    flexBasis: "47%",
    padding: 12,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  cardIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  cardTitle: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  cardValue: { fontSize: 15, fontWeight: "800", marginTop: 3 },
  cardDetail: { fontSize: 10, marginTop: 2 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 8,
  },
  servicesWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  serviceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
});
