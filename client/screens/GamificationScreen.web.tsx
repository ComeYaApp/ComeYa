import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Text,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { MobileSidebarWrapper } from "@/components/MobileSidebarWrapper";

import { WebLayout } from "@/components/WebLayout";

const PRIMARY = "#E60000";

const TIER_COLORS = {
  bronze: "#CD7F32",
  silver: "#9CA3AF",
  gold: "#F59E0B",
  platinum: "#8B5CF6",
};
const TIER_ICONS = { bronze: "🥉", silver: "🥈", gold: "🥇", platinum: "💎" };
const TIER_LABELS = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
};

function resolveProfileImageUrl(img: string): string {
  if (img.startsWith("data:image/")) return img;
  const base = getApiUrl().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(img)) return img;
  return `${base}${img.startsWith("/") ? "" : "/"}${img}`;
}

type Tab = "rewards" | "achievements" | "leaderboard";

export default function GamificationScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("rewards");
  const [profileImage] = useState<string | null>(
    user?.profileImage ? resolveProfileImageUrl(user.profileImage) : null,
  );

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const cardBg = isDark ? "#2a2a2a" : "#f9fafb";

  const { data: pointsData } = useQuery({
    queryKey: ["/api/gamification/points"],
    queryFn: async () =>
      (await apiRequest("GET", "/api/gamification/points")).json(),
  });
  const { data: rewardsData } = useQuery({
    queryKey: ["/api/gamification/rewards"],
    queryFn: async () =>
      (await apiRequest("GET", "/api/gamification/rewards")).json(),
  });
  const { data: achievementsData } = useQuery({
    queryKey: ["/api/gamification/achievements"],
    queryFn: async () =>
      (await apiRequest("GET", "/api/gamification/achievements")).json(),
  });
  const { data: leaderboardData } = useQuery({
    queryKey: ["/api/gamification/leaderboard"],
    queryFn: async () =>
      (
        await apiRequest("GET", "/api/gamification/leaderboard?limit=50")
      ).json(),
  });

  const redeemMutation = useMutation({
    mutationFn: async (rewardId: string) =>
      (
        await apiRequest("POST", `/api/gamification/redeem/${rewardId}`, {})
      ).json(),
    onSuccess: (data) => {
      if (data.success) {
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

  const points = pointsData?.points;
  const rewards = rewardsData?.rewards || [];
  const achievements = achievementsData || { unlocked: [], locked: [] };
  const leaderboard = leaderboardData?.leaderboard || [];

  const tier = (points?.tier || "bronze") as keyof typeof TIER_COLORS;
  const tierColor = TIER_COLORS[tier];
  const tierIcon = TIER_ICONS[tier];
  const tierLabel = TIER_LABELS[tier];

  const getRoleLabel = () => {
    switch (user?.role) {
      case "customer":
        return "Cliente";
      case "business_owner":
        return "Negocio";
      case "delivery_driver":
        return "Repartidor";
      default:
        return "Admin";
    }
  };

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "rewards", label: "Recompensas", icon: "gift" },
    { id: "achievements", label: "Logros", icon: "award" },
    { id: "leaderboard", label: "Ranking", icon: "bar-chart-2" },
  ];

  return (
    <WebLayout>
      <View style={[s.root, { backgroundColor: bg }]}>
        {/* Sidebar */}
        <MobileSidebarWrapper
          title="Mis puntos"
          sidebarStyle={[
            s.sidebar,
            { backgroundColor: card, borderRightColor: border },
          ]}
        >
          <View style={[s.sideHeader, { borderBottomColor: border }]}>
            <Pressable onPress={() => navigation.navigate("EditProfile")}>
              {profileImage ? (
                <Image
                  source={{ uri: profileImage }}
                  style={s.avatar}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={[
                    s.avatar,
                    {
                      backgroundColor: PRIMARY + "20",
                      justifyContent: "center",
                      alignItems: "center",
                    },
                  ]}
                >
                  <Feather name="user" size={36} color={PRIMARY} />
                </View>
              )}
            </Pressable>
            <Text style={[s.userName, { color: text }]}>
              {user?.name || "Usuario"}
            </Text>
            <Text style={[s.userPhone, { color: sub }]}>
              {user?.phone || ""}
            </Text>
            <View style={[s.roleBadge, { backgroundColor: PRIMARY + "15" }]}>
              <Text style={[s.roleBadgeText, { color: PRIMARY }]}>
                {getRoleLabel()}
              </Text>
            </View>
            {/* Tier badge en sidebar */}
            <View
              style={[
                s.tierBadge,
                {
                  backgroundColor: tierColor + "20",
                  borderColor: tierColor + "40",
                },
              ]}
            >
              <Text style={{ fontSize: 18 }}>{tierIcon}</Text>
              <Text style={[s.tierBadgeText, { color: tierColor }]}>
                {tierLabel}
              </Text>
            </View>
            <Text style={[s.sidePoints, { color: text }]}>
              {points?.currentPoints || 0}
            </Text>
            <Text style={[s.sidePointsLabel, { color: sub }]}>
              puntos disponibles
            </Text>
            {points?.pointsToNextTier > 0 && (
              <Text style={[s.sideNextTier, { color: sub }]}>
                {points.pointsToNextTier} pts para {points.nextTier}
              </Text>
            )}
          </View>
          <View style={s.sideNav}>
            {TABS.map((tab) => (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={[s.navItem, activeTab === tab.id && s.navItemActive]}
              >
                <Feather
                  name={tab.icon as any}
                  size={18}
                  color={activeTab === tab.id ? PRIMARY : sub}
                />
                <Text
                  style={[
                    s.navItemText,
                    { color: activeTab === tab.id ? PRIMARY : text },
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={[s.sideFooter, { borderTopColor: border }]}>
            <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
              <Feather name="arrow-left" size={16} color={sub} />
              <Text style={[s.backBtnText, { color: text }]}>Volver</Text>
            </Pressable>
          </View>
        </MobileSidebarWrapper>

        {/* Main */}
        <ScrollView
          style={s.main}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero card de puntos */}
          <View style={[s.heroCard, { backgroundColor: tierColor }]}>
            <View style={s.heroLeft}>
              <Text style={s.heroIcon}>{tierIcon}</Text>
              <View>
                <Text style={s.heroPoints}>{points?.currentPoints || 0}</Text>
                <Text style={s.heroPointsLabel}>puntos disponibles</Text>
                <Text style={s.heroTier}>Nivel {tierLabel}</Text>
              </View>
            </View>
            {points?.pointsToNextTier > 0 && (
              <View style={s.heroRight}>
                <Text style={s.heroNextLabel}>Siguiente nivel</Text>
                <Text style={s.heroNextPts}>{points.pointsToNextTier} pts</Text>
                <View style={s.progressBar}>
                  <View
                    style={[
                      s.progressFill,
                      {
                        width:
                          `${Math.min(100, 100 - (points.pointsToNextTier / (points.pointsToNextTier + points.currentPoints)) * 100)}%` as any,
                        backgroundColor: "rgba(255,255,255,0.9)",
                      },
                    ]}
                  />
                </View>
              </View>
            )}
          </View>

          {/* Tabs */}
          <View
            style={[s.tabRow, { backgroundColor: card, borderColor: border }]}
          >
            {TABS.map((tab) => (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={[
                  s.tab,
                  activeTab === tab.id && {
                    borderBottomColor: PRIMARY,
                    borderBottomWidth: 2,
                  },
                ]}
              >
                <Feather
                  name={tab.icon as any}
                  size={16}
                  color={activeTab === tab.id ? PRIMARY : sub}
                />
                <Text
                  style={[
                    s.tabText,
                    { color: activeTab === tab.id ? PRIMARY : sub },
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Recompensas */}
          {activeTab === "rewards" && (
            <View>
              {rewards.length === 0 ? (
                <View
                  style={[
                    s.empty,
                    { backgroundColor: card, borderColor: border },
                  ]}
                >
                  <Feather name="gift" size={40} color={sub} />
                  <Text style={[s.emptyText, { color: sub }]}>
                    No hay recompensas disponibles
                  </Text>
                </View>
              ) : (
                rewards.map((reward: any) => (
                  <View
                    key={reward.id}
                    style={[
                      s.rewardCard,
                      { backgroundColor: card, borderColor: border },
                    ]}
                  >
                    <View
                      style={[
                        s.rewardIconWrap,
                        { backgroundColor: PRIMARY + "15" },
                      ]}
                    >
                      <Feather name="gift" size={22} color={PRIMARY} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Text style={[s.rewardTitle, { color: text }]}>
                        {reward.title}
                      </Text>
                      <Text style={[s.rewardDesc, { color: sub }]}>
                        {reward.description}
                      </Text>
                      <View style={s.rewardMeta}>
                        <Feather name="star" size={13} color="#F59E0B" />
                        <Text style={[s.rewardPts, { color: "#F59E0B" }]}>
                          {reward.pointsCost} pts
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      onPress={() => redeemMutation.mutate(reward.id)}
                      disabled={!reward.canAfford || redeemMutation.isPending}
                      style={[
                        s.redeemBtn,
                        {
                          backgroundColor: reward.canAfford ? PRIMARY : cardBg,
                          opacity: reward.canAfford ? 1 : 0.5,
                        },
                      ]}
                    >
                      {redeemMutation.isPending ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text
                          style={[
                            s.redeemBtnText,
                            { color: reward.canAfford ? "#fff" : sub },
                          ]}
                        >
                          Canjear
                        </Text>
                      )}
                    </Pressable>
                  </View>
                ))
              )}
            </View>
          )}

          {/* Logros */}
          {activeTab === "achievements" && (
            <View>
              <Text style={[s.groupTitle, { color: text }]}>
                Desbloqueados ({achievements.unlocked.length})
              </Text>
              {achievements.unlocked.map((a: any) => (
                <View
                  key={a.id}
                  style={[
                    s.achievCard,
                    { backgroundColor: card, borderColor: "#10B98130" },
                  ]}
                >
                  <View
                    style={[s.achievIcon, { backgroundColor: "#10B98120" }]}
                  >
                    <Feather name="award" size={22} color="#10B981" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={[s.achievTitle, { color: text }]}>
                      {a.name}
                    </Text>
                    <Text style={[s.achievDesc, { color: sub }]}>
                      {a.description}
                    </Text>
                  </View>
                  <Feather name="check-circle" size={20} color="#10B981" />
                </View>
              ))}
              <Text style={[s.groupTitle, { color: text, marginTop: 24 }]}>
                Bloqueados ({achievements.locked.length})
              </Text>
              {achievements.locked.map((a: any) => (
                <View
                  key={a.id}
                  style={[
                    s.achievCard,
                    {
                      backgroundColor: card,
                      borderColor: border,
                      opacity: 0.6,
                    },
                  ]}
                >
                  <View style={[s.achievIcon, { backgroundColor: cardBg }]}>
                    <Feather name="lock" size={22} color={sub} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={[s.achievTitle, { color: text }]}>
                      {a.name}
                    </Text>
                    <Text style={[s.achievDesc, { color: sub }]}>
                      {a.description}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Ranking */}
          {activeTab === "leaderboard" && (
            <View>
              {leaderboard.map((entry: any, i: number) => {
                const rankColor =
                  i === 0
                    ? "#FFD700"
                    : i === 1
                      ? "#C0C0C0"
                      : i === 2
                        ? "#CD7F32"
                        : cardBg;
                const isMe = entry.userId === user?.id;
                return (
                  <View
                    key={entry.userId}
                    style={[
                      s.rankCard,
                      {
                        backgroundColor: isMe ? PRIMARY + "10" : card,
                        borderColor: isMe ? PRIMARY : border,
                      },
                    ]}
                  >
                    <View style={[s.rankBadge, { backgroundColor: rankColor }]}>
                      <Text
                        style={[s.rankNum, { color: i < 3 ? "#fff" : text }]}
                      >
                        {i + 1}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Text style={[s.rankName, { color: text }]}>
                        {entry.userName}
                        {isMe ? " (tú)" : ""}
                      </Text>
                      <Text style={[s.rankTier, { color: sub }]}>
                        {TIER_LABELS[entry.tier as keyof typeof TIER_LABELS] ||
                          entry.tier}
                      </Text>
                    </View>
                    <Text style={[s.rankPts, { color: PRIMARY }]}>
                      {entry.totalEarned} pts
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    </WebLayout>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", overflow: "hidden" as any },
  sidebar: { width: 280, borderRightWidth: 1, flexDirection: "column" as any },
  sideHeader: { padding: 24, alignItems: "center", borderBottomWidth: 1 },
  avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 12 },
  userName: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
    textAlign: "center",
  },
  userPhone: { fontSize: 13, marginBottom: 8, textAlign: "center" },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  roleBadgeText: { fontSize: 11, fontWeight: "700" },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 8,
  },
  tierBadgeText: { fontSize: 13, fontWeight: "700" },
  sidePoints: { fontSize: 32, fontWeight: "900", marginTop: 4 },
  sidePointsLabel: { fontSize: 12, marginBottom: 4 },
  sideNextTier: { fontSize: 11, textAlign: "center" },
  sideNav: { flex: 1, paddingVertical: 16 },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  navItemActive: {
    backgroundColor: "#E6000010",
    borderRightWidth: 3,
    borderRightColor: "#E60000",
  },
  navItemText: { fontSize: 14, fontWeight: "600" },
  sideFooter: { borderTopWidth: 1, padding: 16 },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  backBtnText: { fontSize: 14, fontWeight: "600" },
  main: { flex: 1, height: "100vh" as any },
  content: { padding: 32, maxWidth: 720, paddingBottom: 80 },
  heroCard: {
    borderRadius: 20,
    padding: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  heroLeft: { flexDirection: "row", alignItems: "center", gap: 16 },
  heroIcon: { fontSize: 52 },
  heroPoints: { fontSize: 40, fontWeight: "900", color: "#fff" },
  heroPointsLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    marginTop: 2,
  },
  heroTier: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "600",
    marginTop: 4,
  },
  heroRight: { alignItems: "flex-end" },
  heroNextLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 4,
  },
  heroNextPts: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 6,
  },
  progressBar: {
    width: 120,
    height: 6,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 3 },
  tabRow: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 24,
    overflow: "hidden",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: { fontSize: 13, fontWeight: "600" },
  empty: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 48,
    alignItems: "center",
    gap: 12,
  },
  emptyText: { fontSize: 15 },
  rewardCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  rewardIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  rewardTitle: { fontSize: 15, fontWeight: "700", marginBottom: 3 },
  rewardDesc: { fontSize: 13, marginBottom: 6 },
  rewardMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  rewardPts: { fontSize: 13, fontWeight: "700" },
  redeemBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  redeemBtnText: { fontSize: 13, fontWeight: "700" },
  groupTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  achievCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
  },
  achievIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  achievTitle: { fontSize: 14, fontWeight: "700", marginBottom: 3 },
  achievDesc: { fontSize: 13 },
  rankCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  rankNum: { fontSize: 14, fontWeight: "800" },
  rankName: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  rankTier: { fontSize: 12 },
  rankPts: { fontSize: 15, fontWeight: "800" },
});
