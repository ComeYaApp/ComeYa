/**
 * BaseProfileScreen - Shared components and utilities for all role-based profile screens
 * This file contains common components, hooks, and styling used across different roles
 */

import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Switch,
  ActivityIndicator,
  TextInput,
  Platform,
  Linking,
  Share,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";

import { ThemedText } from "@/components/ThemedText";
import { Badge } from "@/components/Badge";
import { useTheme } from "@/hooks/useTheme";
import { ThemeMode } from "@/contexts/AppContext";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";

// =============================================================================
// SHARED TYPES
// =============================================================================

export interface SettingsItemProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value?: string;
  onPress: () => void;
  danger?: boolean;
}

export interface ThemeOption {
  value: ThemeMode;
  label: string;
}

// =============================================================================
// SHARED COMPONENTS
// =============================================================================

/**
 * SettingsItem - Reusable settings row component
 */
export function SettingsItem({
  icon,
  label,
  value,
  onPress,
  danger,
}: SettingsItemProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingsItem,
        {
          backgroundColor: pressed ? theme.backgroundSecondary : "transparent",
        },
      ]}
    >
      <View
        style={[
          styles.settingsIcon,
          { backgroundColor: danger ? "#FFEBEE" : theme.backgroundSecondary },
        ]}
      >
        <Feather
          name={icon}
          size={20}
          color={danger ? ComeYaColors.error : ComeYaColors.primary}
        />
      </View>
      <View style={styles.settingsContent}>
        <ThemedText
          type="body"
          style={{ color: danger ? ComeYaColors.error : theme.text }}
        >
          {label}
        </ThemedText>
        {value ? (
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {value}
          </ThemedText>
        ) : null}
      </View>
      <Feather name="chevron-right" size={20} color={theme.textSecondary} />
    </Pressable>
  );
}

// =============================================================================
// SHARED UTILITIES
// =============================================================================

export const themeOptions: ThemeOption[] = [
  { value: "system", label: "Sistema" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
];

/**
 * Resolve profile image URL to handle different formats
 */
export function resolveProfileImageUrl(profileImage: string): string {
  if (!profileImage) return "";
  
  // Base64 - return directly
  if (profileImage.startsWith('data:image/')) {
    return profileImage;
  }

  const apiBase = getApiUrl().replace(/\/+$/, "");

  // Already a full URL
  if (/^https?:\/\//i.test(profileImage)) {
    try {
      const source = new URL(profileImage);
      if (source.hostname === "localhost" || source.hostname === "127.0.0.1") {
        const target = new URL(apiBase);
        source.protocol = target.protocol;
        source.host = target.host;
        return source.toString();
      }
    } catch {
      return profileImage;
    }
    return profileImage;
  }

  return `${apiBase}${profileImage.startsWith("/") ? "" : "/"}${profileImage}`;
}

/**
 * Get theme label in Spanish
 */
export function getThemeLabel(mode: ThemeMode): string {
  switch (mode) {
    case "system": return "Sistema";
    case "light": return "Claro";
    case "dark": return "Oscuro";
    default: return "Sistema";
  }
}

/**
 * Get role label in Spanish
 */
export function getRoleLabel(role?: string): string {
  switch (role) {
    case "customer": return "Cliente";
    case "business_owner": return "Dueño de Negocio";
    case "delivery_driver": return "Repartidor";
    case "admin":
    case "super_admin": return "ComeYa";
    default: return role || "Usuario";
  }
}

/**
 * Handle share to social media
 */
export function shareToSocialMedia(platform: string) {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  const message = encodeURIComponent(
    "Descubre ComeYa - Tu delivery local de confianza en Soria. Pide comida y productos del mercado con un toque."
  );
  const url = encodeURIComponent("https://app.comeya.es");

  let shareUrl = "";
  switch (platform) {
    case "whatsapp":
      shareUrl = `whatsapp://send?text=${message}%20${url}`;
      break;
    case "facebook":
      shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${message}`;
      break;
    case "twitter":
      shareUrl = `https://twitter.com/intent/tweet?text=${message}&url=${url}`;
      break;
    case "telegram":
      shareUrl = `https://t.me/share/url?url=${url}&text=${message}`;
      break;
  }

  Linking.openURL(shareUrl).catch(() => {
    console.log("No se pudo abrir la aplicación");
  });
}

// =============================================================================
// SHARED HOOKS & FUNCTIONS
// =============================================================================

/**
 * Common settings section for preferences
 */
export function renderPreferencesSection(
  theme: any,
  themeMode: ThemeMode,
  settings: any,
  showThemeModal: boolean,
  showNotificationsModal: boolean,
  showLanguageModal: boolean,
  setShowThemeModal: (v: boolean) => void,
  setShowNotificationsModal: (v: boolean) => void,
  setShowLanguageModal: (v: boolean) => void
) {
  return (
    <View style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}>
      <ThemedText type="h4" style={styles.sectionTitle}>
        Preferencias
      </ThemedText>
      <SettingsItem
        icon="moon"
        label="Tema"
        value={getThemeLabel(themeMode)}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowThemeModal(true);
        }}
      />
      <SettingsItem
        icon="bell"
        label="Notificaciones"
        value={settings.notificationsEnabled ? "Activadas" : "Desactivadas"}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowNotificationsModal(true);
        }}
      />
      <SettingsItem
        icon="globe"
        label="Idioma"
        value="Español"
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowLanguageModal(true);
        }}
      />
    </View>
  );
}

/**
 * Common "Más" section with social sharing and legal links
 */
export function renderMasSection(
  theme: any,
  navigation: any,
  showTermsModal: boolean,
  showPrivacyModal: boolean,
  setShowTermsModal: (v: boolean) => void,
  setShowPrivacyModal: (v: boolean) => void,
  handleShare: () => void
) {
  return (
    <View style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}>
      <ThemedText type="h4" style={styles.sectionTitle}>
        Más
      </ThemedText>
      <SettingsItem
        icon="share-2"
        label="Compartir ComeYa"
        onPress={handleShare}
      />
      <View style={styles.socialButtons}>
        <Pressable
          style={[styles.socialButton, { backgroundColor: "#25D366" }]}
          onPress={() => shareToSocialMedia("whatsapp")}
        >
          <Feather name="message-circle" size={20} color="#FFFFFF" />
        </Pressable>
        <Pressable
          style={[styles.socialButton, { backgroundColor: "#1877F2" }]}
          onPress={() => shareToSocialMedia("facebook")}
        >
          <Feather name="facebook" size={20} color="#FFFFFF" />
        </Pressable>
        <Pressable
          style={[styles.socialButton, { backgroundColor: "#1DA1F2" }]}
          onPress={() => shareToSocialMedia("twitter")}
        >
          <Feather name="twitter" size={20} color="#FFFFFF" />
        </Pressable>
        <Pressable
          style={[styles.socialButton, { backgroundColor: "#0088CC" }]}
          onPress={() => shareToSocialMedia("telegram")}
        >
          <Feather name="send" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
      <SettingsItem
        icon="help-circle"
        label="Ayuda y soporte"
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          navigation.navigate("Support");
        }}
      />
      <SettingsItem
        icon="file-text"
        label="Términos y condiciones"
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowTermsModal(true);
        }}
      />
      <SettingsItem
        icon="shield"
        label="Política de privacidad"
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowPrivacyModal(true);
        }}
      />
    </View>
  );
}

// =============================================================================
// SHARED STYLES
// =============================================================================

export const styles = StyleSheet.create({
  // Layout
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  
  // Profile Card
  profileCard: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  userName: {
    marginBottom: Spacing.xs,
  },
  
  // Sections
  section: {
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    overflow: "hidden",
  },
  sectionTitle: {
    padding: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  
  // Settings Item
  settingsItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  settingsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  settingsContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  
  // Social
  socialButtons: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  socialButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  
  // Modal Overlay
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  modalContent: {
    width: "100%",
    maxWidth: 340,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: "center",
  },
  modalIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  modalMessage: {
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    width: "100%",
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonFull: {
    width: "100%",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.md,
  },
  cancelButton: {
    borderWidth: 1,
  },
  logoutButton: {
    backgroundColor: ComeYaColors.error,
  },
  
  // Theme Options
  themeOptions: {
    width: "100%",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  themeOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
  },
  
  // Switch
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  
  // Coming Soon
  comingSoon: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  
  // Full Screen Modal
  fullScreenModal: {
    flex: 1,
  },
  fullScreenHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  fullScreenContent: {
    flex: 1,
  },
  
  // Edit Modal Card
  editModalCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
  },
  editModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  editModalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  editModalTabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  editModalTab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  editModalBody: {
    padding: Spacing.lg,
    paddingBottom: Spacing["4xl"],
  },
  editInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
    marginBottom: 4,
  },
  editSaveBtn: {
    height: 50,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.xl,
  },
  
  // Version
  version: {
    textAlign: "center",
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  
  // Legal
  legalTitle: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  legalText: {
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  
// Info Card
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
},

});

// Shared styles end
