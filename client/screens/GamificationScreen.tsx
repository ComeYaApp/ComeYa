import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  FlatList,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useToast } from "@/contexts/ToastContext";

const TIER_COLORS = {
  bronze: "#CD7F32",
  silver: "#C0C0C0",
  gold: "#FFD700",
  platinum: "#E5E4E2",
};

const TIER_ICONS = {
  bronze: "🥉",
  silver: "🥈",
  gold: "🥇",
  platinum: "💎",
};

export default function GamificationScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<
    "rewards" | "achievements" | "leaderboard"
  >("rewards");
  const [refreshing, setRefreshing] = useState(false);

  // Puntos del usuario
  const { data: pointsData, refetch: refetchPoints } = useQuery({
    queryKey: ["/api/gamification/points"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/gamification/points");
      return response.json();
    },
  });

  // Recompensas
  const { data: rewardsData } = useQuery({
    queryKey: ["/api/gamification/rewards"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/gamification/rewards");
      return response.json();
    },
  });

  // Achievements
  const { data: achievementsData } = useQuery({
    queryKey: ["/api/gamification/achievements"],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        "/api/gamification/achievements",
      );
      return response.json();
    },
  });

  // Leaderboard
  const { data: leaderboardData } = useQuery({
    queryKey: ["/api/gamification/leaderboard"],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        "/api/gamification/leaderboard?limit=50",
      );
      return response.json();
    },
  });

  // Canjear recompensa
  const redeemMutation = useMutation({
    mutationFn: async (rewardId: string) => {
      const response = await apiRequest(
        "POST",
        `/api/gamification/redeem/${rewardId}`,
        {},
      );
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast("¡Recompensa canjeada!", "success");
        queryClient.invalidateQueries({
          queryKey: ["/api/gamification/points"],
        });
        queryClient.invalidateQueries({
          queryKey: ["/api/gamification/rewards"],
        });
      } else {
        showToast(data.error || "Error al canjear", "error");
      }
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetchPoints();
    setRefreshing(false);
  };

  const points = pointsData?.points;
  const rewards = rewardsData?.rewards || [];
  const achievements = achievementsData || { unlocked: [], locked: [] };
  const leaderboard = leaderboardData?.leaderboard || [];

  const tierColor = points?.tier
    ? TIER_COLORS[points.tier as keyof typeof TIER_COLORS]
    : TIER_COLORS.bronze;
  const tierIcon = points?.tier
    ? TIER_ICONS[points.tier as keyof typeof TIER_ICONS]
    : TIER_ICONS.bronze;

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h2">Gamificación</ThemedText>
        <View style={{ width: 44 }} />
      </View>

      {/* Points Card */}
      <LinearGradient
        colors={[tierColor, tierColor + "80"]}
        style={[styles.pointsCard, Shadows.lg]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.pointsHeader}>
          <ThemedText type="h1" style={{ color: "#FFFFFF", fontSize: 48 }}>
            {tierIcon}
          </ThemedText>
          <View style={styles.pointsInfo}>
            <ThemedText type="h2" style={{ color: "#FFFFFF" }}>
              {points?.currentPoints || 0}
            </ThemedText>
            <ThemedText
              type="caption"
              style={{ color: "#FFFFFF", opacity: 0.9 }}
            >
              Puntos disponibles
            </ThemedText>
          </View>
        </View>
        <View style={styles.tierRow}>
          <ThemedText
            type="body"
            style={{ color: "#FFFFFF", textTransform: "capitalize" }}
          >
            Tier: {points?.tier || "Bronze"}
          </ThemedText>
          {points?.pointsToNextTier > 0 && (
            <ThemedText
              type="caption"
              style={{ color: "#FFFFFF", opacity: 0.8 }}
            >
              {points.pointsToNextTier} pts para siguiente nivel
            </ThemedText>
          )}
        </View>
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(["rewards", "achievements", "leaderboard"] as const).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => {
              setActiveTab(tab);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={[
              styles.tab,
              {
                backgroundColor:
                  activeTab === tab
                    ? ComeYaColors.primary
                    : theme.backgroundSecondary,
              },
            ]}
          >
            <ThemedText
              type="caption"
              style={{
                color: activeTab === tab ? "#FFFFFF" : theme.text,
                fontWeight: activeTab === tab ? "600" : "400",
              }}
            >
              {tab === "rewards"
                ? "Recompensas"
                : tab === "achievements"
                  ? "Logros"
                  : "Ranking"}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Rewards Tab */}
        {activeTab === "rewards" && (
          <View>
            {rewards.map((reward: any) => (
              <View
                key={reward.id}
                style={[
                  styles.rewardCard,
                  { backgroundColor: theme.card },
                  Shadows.sm,
                ]}
              >
                <View style={styles.rewardLeft}>
                  <ThemedText type="h4">{reward.title}</ThemedText>
                  <ThemedText
                    type="caption"
                    style={{ color: theme.textSecondary, marginTop: 4 }}
                  >
                    {reward.description}
                  </ThemedText>
                  <View style={styles.rewardMeta}>
                    <View style={styles.pointsBadge}>
                      <Feather
                        name="star"
                        size={14}
                        color={ComeYaColors.warning}
                      />
                      <ThemedText type="caption" style={{ marginLeft: 4 }}>
                        {reward.pointsCost} pts
                      </ThemedText>
                    </View>
                  </View>
                </View>
                <Pressable
                  onPress={() => redeemMutation.mutate(reward.id)}
                  disabled={!reward.canAfford || redeemMutation.isPending}
                  style={[
                    styles.redeemButton,
                    {
                      backgroundColor: reward.canAfford
                        ? ComeYaColors.primary
                        : theme.backgroundSecondary,
                      opacity:
                        reward.canAfford && !redeemMutation.isPending ? 1 : 0.5,
                    },
                  ]}
                >
                  <ThemedText
                    type="caption"
                    style={{
                      color: reward.canAfford ? "#FFFFFF" : theme.textSecondary,
                      fontWeight: "600",
                    }}
                  >
                    Canjear
                  </ThemedText>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Achievements Tab */}
        {activeTab === "achievements" && (
          <View>
            <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
              Desbloqueados ({achievements.unlocked.length})
            </ThemedText>
            {achievements.unlocked.map((achievement: any) => (
              <View
                key={achievement.id}
                style={[
                  styles.achievementCard,
                  { backgroundColor: theme.card },
                  Shadows.sm,
                ]}
              >
                <View
                  style={[
                    styles.achievementIcon,
                    { backgroundColor: ComeYaColors.success + "20" },
                  ]}
                >
                  <Feather
                    name="award"
                    size={24}
                    color={ComeYaColors.success}
                  />
                </View>
                <View style={styles.achievementInfo}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    {achievement.name}
                  </ThemedText>
                  <ThemedText
                    type="caption"
                    style={{ color: theme.textSecondary }}
                  >
                    {achievement.description}
                  </ThemedText>
                </View>
                <Feather
                  name="check-circle"
                  size={20}
                  color={ComeYaColors.success}
                />
              </View>
            ))}

            <ThemedText
              type="h4"
              style={{ marginTop: Spacing.lg, marginBottom: Spacing.md }}
            >
              Bloqueados ({achievements.locked.length})
            </ThemedText>
            {achievements.locked.map((achievement: any) => (
              <View
                key={achievement.id}
                style={[
                  styles.achievementCard,
                  { backgroundColor: theme.card, opacity: 0.6 },
                  Shadows.sm,
                ]}
              >
                <View
                  style={[
                    styles.achievementIcon,
                    { backgroundColor: theme.backgroundSecondary },
                  ]}
                >
                  <Feather name="lock" size={24} color={theme.textSecondary} />
                </View>
                <View style={styles.achievementInfo}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    {achievement.name}
                  </ThemedText>
                  <ThemedText
                    type="caption"
                    style={{ color: theme.textSecondary }}
                  >
                    {achievement.description}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Leaderboard Tab */}
        {activeTab === "leaderboard" && (
          <View>
            {leaderboard.map((entry: any, index: number) => (
              <View
                key={entry.userId}
                style={[
                  styles.leaderboardCard,
                  { backgroundColor: theme.card },
                  Shadows.sm,
                ]}
              >
                <View style={styles.leaderboardLeft}>
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
                    <ThemedText
                      type="caption"
                      style={{
                        color: index < 3 ? "#FFFFFF" : theme.text,
                        fontWeight: "600",
                      }}
                    >
                      {index + 1}
                    </ThemedText>
                  </View>
                  <View style={styles.leaderboardInfo}>
                    <ThemedText type="body" numberOfLines={1}>
                      {entry.userName}
                    </ThemedText>
                    <ThemedText
                      type="caption"
                      style={{
                        color: theme.textSecondary,
                        textTransform: "capitalize",
                      }}
                    >
                      {entry.tier}
                    </ThemedText>
                  </View>
                </View>
                <ThemedText
                  type="body"
                  style={{ fontWeight: "600", color: ComeYaColors.primary }}
                >
                  {entry.totalEarned} pts
                </ThemedText>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  pointsCard: {
    marginHorizontal: Spacing.lg,
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
  },
  pointsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  pointsInfo: {
    marginLeft: Spacing.lg,
  },
  tierRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tabs: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing["4xl"],
  },
  rewardCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.md,
  },
  rewardLeft: {
    flex: 1,
  },
  rewardMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  pointsBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  redeemButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  achievementCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.md,
  },
  achievementIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  achievementInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  leaderboardCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.md,
  },
  leaderboardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  leaderboardInfo: {
    marginLeft: Spacing.md,
    flex: 1,
  },
});
