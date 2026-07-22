import React from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ComeYaLogo } from "@/components/ComeYaLogo";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type GuestProfileScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Profile">;
};

export default function GuestProfileScreen({ navigation }: GuestProfileScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const handleLogin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("Login");
  };

  const handleSignup = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("Signup");
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: insets.top + Spacing.xl,
          paddingBottom: insets.bottom + Spacing.xl,
          backgroundColor: theme.background,
        },
      ]}
    >
      <View style={styles.logoSection}>
        <ComeYaLogo size={100} />
        <ThemedText type="hero" style={styles.title}>
          ComeYa
        </ThemedText>
        <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
          Tu delivery local de confianza
        </ThemedText>
      </View>

      <View style={styles.actionsContainer}>
        <Pressable
          onPress={handleLogin}
          style={[styles.loginButton, Shadows.md]}
        >
          <Feather name="log-in" size={22} color="#FFFFFF" />
          <ThemedText type="body" style={styles.loginButtonText}>
            Iniciar sesión
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={handleSignup}
          style={[styles.signupButton, { borderColor: ComeYaColors.primary }]}
        >
          <Feather name="user-plus" size={22} color={ComeYaColors.primary} />
          <ThemedText type="body" style={styles.signupButtonText}>
            Registrarse
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.infoSection}>
        <ThemedText type="small" style={[styles.infoText, { color: theme.textSecondary }]}>
          Puedes explorar restaurantes, mercados y productos sin necesidad de registrarte.
        </ThemedText>
        <View style={styles.infoRow}>
          <Feather name="home" size={16} color={theme.textSecondary} />
          <ThemedText type="small" style={[styles.infoLabel, { color: theme.textSecondary }]}>
            Pestaña Inicio — negocios y categorías
          </ThemedText>
        </View>
        <View style={styles.infoRow}>
          <Feather name="map-pin" size={16} color={theme.textSecondary} />
          <ThemedText type="small" style={[styles.infoLabel, { color: theme.textSecondary }]}>
            Pestaña Mapa — busca locales cercanos
          </ThemedText>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    alignItems: "center",
  },
  logoSection: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  title: {
    marginTop: Spacing.md,
  },
  subtitle: {
    marginTop: Spacing.xs,
    fontSize: 15,
  },
  actionsContainer: {
    width: "100%",
    gap: Spacing.md,
    marginBottom: Spacing["3xl"],
  },
  loginButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ComeYaColors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  signupButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    gap: Spacing.sm,
  },
  signupButtonText: {
    color: ComeYaColors.primary,
    fontWeight: "600",
    fontSize: 16,
  },
  infoSection: {
    width: "100%",
    paddingTop: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: "rgba(128,128,128,0.2)",
  },
  infoText: {
    textAlign: "center",
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  infoLabel: {
    flex: 1,
  },
});