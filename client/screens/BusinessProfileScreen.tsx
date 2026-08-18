/**
 * BusinessProfileScreen - Profile screen for business_owner role
 * Contains business-specific features and settings
 */

import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";

import { ThemedText } from "@/components/ThemedText";
import { Badge } from "@/components/Badge";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import {
  SettingsItem,
  resolveProfileImageUrl,
  getRoleLabel,
  styles as baseStyles,
  themeOptions,
} from "./BaseProfileScreen";

type BusinessProfileNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;

export default function BusinessProfileScreen() {
  const { theme, themeMode, setThemeMode } = useTheme();
  const { user, updateUser, logout } = useAuth();
  const { showToast } = useToast();
  const navigation = useNavigation<BusinessProfileNavigationProp>();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const [profileImage, setProfileImage] = useState<string>("");
  const [profileImageVersion, setProfileImageVersion] = useState<number>(
    Date.now(),
  );
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Load profile image on mount
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      setIsLoading(false);

      // Load from user object first
      if (user.profileImage) {
        const img = user.profileImage;
        if (img.startsWith("data:image/")) {
          setProfileImage(img);
        } else {
          const baseUrl = resolveProfileImageUrl(img);
          setProfileImage(`${baseUrl}?v=${profileImageVersion}`);
        }
      }
    };
    loadProfile();
  }, [user, profileImageVersion]);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setIsUploadingImage(true);
        const uri = result.assets[0].uri;

        // Upload to server
        const formData = new FormData();
        formData.append("profileImage", {
          uri,
          type: "image/jpeg",
          name: "profile.jpg",
        } as any);

        const response = await apiRequest(
          "POST",
          "/api/users/profile-image",
          formData,
        );
        const data = await response.json();

        if (data.success) {
          const newVersion = Date.now();
          setProfileImageVersion(newVersion);
          const newUrl = resolveProfileImageUrl(data.imageUrl);
          setProfileImage(`${newUrl}?v=${newVersion}`);
          showToast("Foto de perfil actualizada", "success");
        } else {
          showToast(data.message || "Error al subir imagen", "error");
        }
        setIsUploadingImage(false);
      }
    } catch (error) {
      console.log("Error picking image:", error);
      setIsUploadingImage(false);
    }
  };

  const styles = StyleSheet.create({
    ...baseStyles,
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    modalOption: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      paddingVertical: Spacing.md,
    },
    modalText: {
      textAlign: "center",
      marginBottom: Spacing.lg,
    },
    modalButtonCancel: {
      backgroundColor: "#666",
    },
    modalButtonConfirm: {
      backgroundColor: "#ef4444",
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingTop: Spacing.md,
      paddingBottom: Spacing.xl + Math.max(tabBarHeight, insets.bottom + 64),
    },
    profileCard: {
      backgroundColor: theme.card,
      marginHorizontal: Spacing.lg,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
      ...Shadows.md,
    },
    avatarContainer: {
      alignSelf: "center",
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
      backgroundColor: ComeYaColors.primary,
      justifyContent: "center",
      alignItems: "center",
    },
    userName: {
      textAlign: "center",
      marginBottom: Spacing.xs,
    },
    section: {
      backgroundColor: theme.card,
      marginHorizontal: Spacing.lg,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
      ...Shadows.sm,
    },
    sectionTitle: {
      marginBottom: Spacing.md,
    },
  });

  const getRoleLabelText = () => {
    switch (user?.role) {
      case "business_owner":
        return "Dueño de Negocio";
      default:
        return user?.role || "Usuario";
    }
  };

  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator size="large" color={ComeYaColors.primary} />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={[
        theme.gradientStart || "#FFFFFF",
        theme.gradientEnd || "#F5F5F5",
      ]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: theme.card }]}>
          <Pressable
            style={styles.avatarContainer}
            onPress={pickImage}
            disabled={isUploadingImage}
          >
            <Image
              source={
                profileImage
                  ? { uri: profileImage }
                  : require("../../assets/images/avatar-placeholder.png")
              }
              style={[styles.avatar, isUploadingImage && { opacity: 0.5 }]}
              contentFit="cover"
            />
            {isUploadingImage ? (
              <View
                style={[
                  styles.editBadge,
                  { backgroundColor: ComeYaColors.primary },
                ]}
              >
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            ) : (
              <View
                style={[
                  styles.editBadge,
                  { backgroundColor: ComeYaColors.primary },
                ]}
              >
                <Feather name="camera" size={14} color="#FFFFFF" />
              </View>
            )}
          </Pressable>
          <ThemedText type="h2" style={styles.userName}>
            {user?.name || "Usuario"}
          </ThemedText>
          <ThemedText
            type="body"
            style={{ color: theme.textSecondary, textAlign: "center" }}
          >
            {user?.phone || "Sin teléfono"}
          </ThemedText>
          <Badge
            text={getRoleLabelText()}
            variant="primary"
            style={{ marginTop: Spacing.sm, alignSelf: "center" }}
          />
        </View>

        {/* Business Owner Settings */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Mi Negocio
          </ThemedText>

          <SettingsItem
            icon="briefcase"
            label="Mis Negocios"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate("BusinessMore" as any);
            }}
          />
          <SettingsItem
            icon="clock"
            label="Horarios de atención"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate("BusinessHours" as any);
            }}
          />
          <SettingsItem
            icon="bar-chart-2"
            label="Analíticas"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate("BusinessAnalytics" as any);
            }}
          />
          <SettingsItem
            icon="dollar-sign"
            label="Finanzas"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate("BusinessFinances" as any);
            }}
          />
        </View>

        {/* Account Section */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Cuenta
          </ThemedText>

          <SettingsItem
            icon="user"
            label="Editar perfil"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate("EditProfile" as any);
            }}
          />
          <SettingsItem
            icon="map-pin"
            label="Direcciones"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate("SavedAddresses");
            }}
          />
        </View>

        {/* Preferences */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Preferencias
          </ThemedText>

          <SettingsItem
            icon="moon"
            label="Tema"
            value={
              themeMode === "system"
                ? "Sistema"
                : themeMode === "light"
                  ? "Claro"
                  : "Oscuro"
            }
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowThemeModal(true);
            }}
          />
          <SettingsItem
            icon="bell"
            label="Notificaciones"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate("NotificationPreferences" as any);
            }}
          />
        </View>

        {/* Support */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Soporte
          </ThemedText>

          <SettingsItem
            icon="help-circle"
            label="Ayuda"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate("Support" as any);
            }}
          />
          <SettingsItem
            icon="file-text"
            label="Términos y condiciones"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate("Terms" as any);
            }}
          />
          <SettingsItem
            icon="shield"
            label="Política de privacidad"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate("Privacy" as any);
            }}
          />
        </View>

        {/* Delete Account */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <SettingsItem
            icon="trash-2"
            label="Eliminar cuenta"
            danger
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              navigation.navigate("DeleteAccount" as any);
            }}
          />
        </View>

        {/* Logout */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <SettingsItem
            icon="log-out"
            label="Cerrar sesión"
            danger
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowLogoutModal(true);
            }}
          />
        </View>
      </ScrollView>

      <Modal visible={showThemeModal} transparent animationType="fade">
        <View style={baseStyles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setShowThemeModal(false)}
          />
          <View
            style={[baseStyles.modalContent, { backgroundColor: theme.card }]}
          >
            <ThemedText type="h3" style={baseStyles.modalTitle}>
              Seleccionar tema
            </ThemedText>
            {themeOptions.map((option) => (
              <Pressable
                key={option.value}
                style={styles.modalOption}
                onPress={() => {
                  setThemeMode(option.value);
                  setShowThemeModal(false);
                }}
              >
                <ThemedText type="body">{option.label}</ThemedText>
                {themeMode === option.value && (
                  <Feather
                    name="check"
                    size={20}
                    color={ComeYaColors.primary}
                  />
                )}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      <Modal visible={showLogoutModal} transparent animationType="fade">
        <View style={baseStyles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setShowLogoutModal(false)}
          />
          <View
            style={[baseStyles.modalContent, { backgroundColor: theme.card }]}
          >
            <ThemedText type="h3" style={styles.modalTitle}>
              Cerrar sesión
            </ThemedText>
            <ThemedText type="body" style={styles.modalText}>
              ¿Estás seguro de que quieres cerrar sesión?
            </ThemedText>
            <View style={styles.modalButtons}>
              <Pressable
                style={[
                  styles.modalButton,
                  styles.modalButtonCancel,
                  { backgroundColor: theme.background },
                ]}
                onPress={() => setShowLogoutModal(false)}
              >
                <ThemedText type="body">Cancelar</ThemedText>
              </Pressable>
              <Pressable
                style={[
                  styles.modalButton,
                  styles.modalButtonConfirm,
                  { backgroundColor: "#ef4444" },
                ]}
                onPress={() => {
                  setShowLogoutModal(false);
                  logout();
                }}
              >
                <ThemedText type="body" style={{ color: "#fff" }}>
                  Cerrar sesión
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}
