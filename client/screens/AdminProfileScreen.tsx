/**
 * AdminProfileScreen - Profile screen for admin/super_admin role
 * Contains admin-specific features and settings
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
  styles as baseStyles,
} from "./BaseProfileScreen";

type AdminProfileNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function AdminProfileScreen() {
  const { theme, themeMode } = useTheme();
  const { user, updateUser, logout } = useAuth();
  const { showToast } = useToast();
  const navigation = useNavigation<AdminProfileNavigationProp>();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const [profileImage, setProfileImage] = useState<string>("");
  const [profileImageVersion, setProfileImageVersion] = useState<number>(
    Date.now(),
  );
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Load profile image on mount
  useEffect(() => {
  const loadProfile = async () => {
      setIsLoading(false);
      if (!user) return;

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
      case "super_admin":
        return "ComeYa";
      case "admin":
        return "Administrador";
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
            {user?.name || "Administrador"}
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

        {/* Cuenta — primera sección visible */}
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
            icon="lock"
            label="Cambiar contraseña"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate("ChangePassword" as any);
            }}
          />
        </View>

        {/* Finanzas */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Finanzas
          </ThemedText>
          <SettingsItem
            icon="trending-up"
            label="Finanzas"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate("FinanceTab" as any);
            }}
          />
          <SettingsItem
            icon="credit-card"
            label="Cuentas de pago"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate("AdminPaymentAccounts" as any);
            }}
          />
        </View>

        {/* Cerrar sesión */}
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

      {/* Logout Modal */}
      <Modal visible={showLogoutModal} transparent animationType="fade">
        <View style={baseStyles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setShowLogoutModal(false)}
          />
          <View style={[baseStyles.modalContent, { backgroundColor: theme.card }]}>
            <ThemedText type="h3" style={baseStyles.modalTitle}>
              Cerrar sesión
            </ThemedText>
            <ThemedText
              type="body"
              style={[baseStyles.modalMessage, { textAlign: "center", marginBottom: Spacing.lg }]}
            >
              ¿Estás seguro de que quieres cerrar sesión?
            </ThemedText>
            <View style={baseStyles.modalButtons}>
              <Pressable
                style={[
                  baseStyles.modalButton,
                  { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border },
                ]}
                onPress={() => setShowLogoutModal(false)}
              >
                <ThemedText type="body">Cancelar</ThemedText>
              </Pressable>
              <Pressable
                style={[baseStyles.modalButton, { backgroundColor: "#ef4444" }]}
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
