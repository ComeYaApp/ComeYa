import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { apiRequest } from "@/lib/query-client";
import { useTheme } from "@/hooks/useTheme";
import { ComeYaColors } from "../../../constants/theme";

// Ranking de clientes que más compran: SOLO visible para el administrador
// (protección de datos — antes cualquier cliente lo veía).
export const RankingTab: React.FC = () => {
  const { theme } = useTheme();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest(
          "GET",
          "/api/gamification/leaderboard?limit=50",
        );
        const data = await res.json();
        setEntries(data?.leaderboard || []);
      } catch {
        setEntries([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={ComeYaColors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={[styles.title, { color: theme.text }]}>
        Ranking de clientes (privado)
      </Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Solo visible para administradores — datos personales protegidos.
      </Text>
      {entries.map((entry: any, index: number) => (
        <View
          key={entry.userId}
          style={[styles.card, { backgroundColor: theme.card }]}
        >
          <View
            style={[
              styles.rankBadge,
              {
                backgroundColor:
                  index === 0
                    ? "#FFD700"
                    : index === 1
                      ? "#C0C0C0"
                      : index === 2
                        ? "#CD7F32"
                        : theme.backgroundSecondary,
              },
            ]}
          >
            <Text
              style={[
                styles.rankText,
                { color: index < 3 ? "#FFFFFF" : theme.text },
              ]}
            >
              {index + 1}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.userName, { color: theme.text }]} numberOfLines={1}>
              {entry.userName}
            </Text>
            <Text
              style={[
                styles.tierText,
                { color: theme.textSecondary, textTransform: "capitalize" },
              ]}
            >
              {entry.tier}
            </Text>
          </View>
          <Text style={[styles.pointsText, { color: ComeYaColors.primary }]}>
            {entry.totalEarned} pts
          </Text>
        </View>
      ))}
      {entries.length === 0 && (
        <Text style={[styles.subtitle, { color: theme.textSecondary, textAlign: "center", marginTop: 24 }]}>
          Aún no hay puntos registrados.
        </Text>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  subtitle: { fontSize: 12, marginBottom: 16 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  rankText: { fontSize: 14, fontWeight: "700" },
  userName: { fontSize: 15, fontWeight: "600" },
  tierText: { fontSize: 12, marginTop: 2 },
  pointsText: { fontSize: 15, fontWeight: "700", marginLeft: 12 },
});
