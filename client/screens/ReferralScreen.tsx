import React, { useState, useEffect } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Share,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/contexts/ToastContext";
import { apiRequest } from "@/lib/query-client";
import {
  ComeYaColors,
  Spacing,
  BorderRadius,
  Shadows,
} from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";

type ReferralSummary = {
  referralCode: string;
  shareLink: string;
  rewardPoints: number;
  invitedCount: number;
  completedCount: number;
};

export default function ReferralScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ReferralSummary | null>(null);

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    try {
      const res = await apiRequest("GET", "/api/referrals/summary");
      const data = await res.json();
      if (data.success) setSummary(data);
      else throw new Error(data.error);
    } catch {
      showToast("No se pudo cargar tu código de invitación", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!summary) return;
    const message =
      `¡Únete a ComeYa, tu delivery local de Soria! ` +
      `Regístrate con mi código ${summary.referralCode} y gana puntos en tu primer pedido: ` +
      summary.shareLink;
    try {
      await Share.share({ message });
    } catch {
      /* usuario canceló el diálogo */
    }
  };

  const stats = [
    {
      icon: "users" as const,
      label: "Invitados",
      value: summary?.invitedCount ?? 0,
    },
    {
      icon: "check-circle" as const,
      label: "Primeros pedidos",
      value: summary?.completedCount ?? 0,
    },
    {
      icon: "gift" as const,
      label: "Puntos por invitación",
      value: summary?.rewardPoints ?? 0,
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h2" style={styles.headerTitle}>
          Invita y Gana
        </ThemedText>
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={ComeYaColors.primary}
          style={styles.loader}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[styles.card, { backgroundColor: theme.card }]}
          >
            <View style={styles.cardIcon}>
              <Feather name="share-2" size={28} color="#fff" />
            </View>
            <ThemedText type="h3" style={styles.cardTitle}>
              Tu código de invitación
            </ThemedText>
            <ThemedText
              type="caption"
              style={{ color: theme.textSecondary, textAlign: "center" }}
            >
              Compártelo con tus amigos. Cuando tu invitado complete su primer
              pedido, recibirás {summary?.rewardPoints ?? 0} puntos canjeables
              por recompensas.
            </ThemedText>

            <View
              style={[
                styles.codeBox,
                { borderColor: ComeYaColors.primary + "40" },
              ]}
            >
              <ThemedText type="h2" style={styles.codeText}>
                {summary?.referralCode || "—"}
              </ThemedText>
            </View>

            <Pressable
              style={[styles.shareButton]}
              onPress={handleShare}
            >
              <Feather name="send" size={18} color="#fff" />
              <ThemedText type="body" style={{ color: "#fff", fontWeight: "700" }}>
                Compartir invitación
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.statsRow}>
            {stats.map((s) => (
              <View
                key={s.label}
                style={[styles.statCard, { backgroundColor: theme.card }]}
              >
                <Feather
                  name={s.icon}
                  size={20}
                  color={ComeYaColors.primary}
                />
                <ThemedText type="h3" style={styles.statValue}>
                  {s.value}
                </ThemedText>
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary, textAlign: "center" }}
                >
                  {s.label}
                </ThemedText>
              </View>
            ))}
          </View>

          <View
            style={[styles.howCard, { backgroundColor: theme.card }]}
          >
            <ThemedText type="body" style={styles.howTitle}>
              ¿Cómo funciona?
            </ThemedText>
            {[
              "Comparte tu código con quien quieras.",
              "Tu amigo se registra en ComeYa usando tu enlace o tu código.",
              "Cuando complete su primer pedido, recibes tus puntos automáticamente.",
              "Canjea tus puntos por recompensas en «Mis puntos y recompensas».",
            ].map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNumber}>
                  <ThemedText
                    type="caption"
                    style={{ color: "#fff", fontWeight: "700" }}
                  >
                    {i + 1}
                  </ThemedText>
                </View>
                <ThemedText
                  type="body"
                  style={{ flex: 1, color: theme.textSecondary }}
                >
                  {step}
                </ThemedText>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  backBtn: { padding: Spacing.xs },
  headerTitle: { marginLeft: Spacing.sm },
  loader: { marginTop: 48 },
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 40 },
  card: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  cardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: ComeYaColors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitle: { fontWeight: "700" },
  codeBox: {
    borderWidth: 2,
    borderRadius: BorderRadius.lg,
    borderStyle: "dashed",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  codeText: {
    letterSpacing: 3,
    color: ComeYaColors.primary,
    fontWeight: "800",
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: ComeYaColors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.full,
  },
  statsRow: { flexDirection: "row", gap: Spacing.sm },
  statCard: {
    flex: 1,
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
    ...Shadows.sm,
  },
  statValue: { fontWeight: "700" },
  howCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  howTitle: { fontWeight: "700" },
  stepRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ComeYaColors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
});
