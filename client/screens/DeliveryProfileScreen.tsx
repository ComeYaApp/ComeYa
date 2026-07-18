/**
 * DeliveryProfileScreen - Profile screen for delivery_driver role
 * Contains driver-specific features and settings
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

type DeliveryProfileNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;

interface DriverStats {
  rating: number;
  totalDeliveries: number;
  vehicleType?: string;
  vehiclePlate?: string;
  verificationStatus: string;
  // Personal documents
  idDocumentUrl?: string | null;
  idDocumentBackUrl?: string | null;
  autonomoDocumentUrl?: string | null;
  // Vehicle documents
  vehiclePlatePhoto?: string | null;
  vehicleItvPhoto?: string | null;
  vehicleInsurancePhoto?: string | null;
  vehicleLicensePhoto?: string | null;
}

export default function DeliveryProfileScreen() {
  const { theme, themeMode } = useTheme();
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();
  const navigation = useNavigation<DeliveryProfileNavigationProp>();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const [profileImage, setProfileImage] = useState<string>("");
  const [profileImageVersion, setProfileImageVersion] = useState<number>(
    Date.now(),
  );
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [driverStats, setDriverStats] = useState<DriverStats | null>(null);
  const [driverStrikes, setDriverStrikes] = useState(0);
  const maxStrikes = 5;

  // Preview modal state
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Helper to resolve document URL
  const resolveDocumentUrl = (
    url: string | null | undefined,
  ): string | null => {
    if (!url) return null;
    if (url.startsWith("data:image/")) return url;
    if (/^https?:\/\//i.test(url)) return url;
    const apiBase = getApiUrl().replace(/\/+$/, "");
    return `${apiBase}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  // Preview handler
  const handlePreviewDocument = (uri: string | null | undefined) => {
    if (!uri) return;
    const resolved = resolveDocumentUrl(uri) || uri;
    setPreviewImage(resolved);
    setShowPreviewModal(true);
  };

  // Load driver status on mount
  useEffect(() => {
    const loadDriverStatus = async () => {
      if (user?.role !== "delivery_driver") {
        setIsLoading(false);
        return;
      }

      try {
        const [statusRes, profileRes] = await Promise.all([
          apiRequest("GET", "/api/delivery/status"),
          apiRequest("GET", "/api/users/profile/full"),
        ]);
        const statusData = await statusRes.json();
        const profileData = await profileRes.json();

        if (statusData.success) {
          setDriverStrikes(statusData.strikes || 0);
        }
        if (profileData.success) {
          setDriverStats({
            rating: statusData.rating || 0,
            totalDeliveries: statusData.totalDeliveries || 0,
            vehicleType: profileData.vehicleType,
            vehiclePlate: profileData.vehiclePlate,
            verificationStatus: user?.isActive ? "verified" : "pending",
            // Personal documents
            idDocumentUrl: profileData.idDocumentUrl,
            idDocumentBackUrl: profileData.idDocumentBackUrl,
            autonomoDocumentUrl: profileData.autonomoDocumentUrl,
            // Vehicle documents
            vehiclePlatePhoto: profileData.vehiclePlatePhoto,
            vehicleItvPhoto: profileData.vehicleItvPhoto,
            vehicleInsurancePhoto: profileData.vehicleInsurancePhoto,
            vehicleLicensePhoto: profileData.vehicleLicensePhoto,
          });
        }
      } catch (error) {
        console.log("Error loading driver status:", error);
      }
      setIsLoading(false);
    };

    loadDriverStatus();
  }, [user?.role, user?.isActive]);

  // Load profile image
  useEffect(() => {
    const loadProfile = async () => {
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

  const getVehicleLabel = () => {
    if (!driverStats?.vehicleType) return "No registrado";
    const typeLabel =
      driverStats.vehicleType === "car"
        ? "Coche"
        : driverStats.vehicleType === "motorcycle"
          ? "Moto"
          : "Bicicleta";
    return driverStats.vehiclePlate
      ? `${typeLabel} · ${driverStats.vehiclePlate}`
      : typeLabel;
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
    statsRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: Spacing.md,
    },
    statCard: {
      flex: 1,
      backgroundColor: theme.backgroundSecondary,
      borderRadius: 12,
      padding: 12,
      alignItems: "center",
    },
    statValue: {
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    strikesContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: Spacing.md,
      paddingTop: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    strikesVisual: {
      flexDirection: "row",
      gap: 4,
    },
    strikeIndicator: {
      width: 20,
      height: 12,
      borderRadius: 2,
      borderWidth: 1,
    },
    documentsSection: {
      marginTop: Spacing.md,
      paddingTop: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    docHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: Spacing.sm,
    },
    docGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Spacing.sm,
    },
    docItem: {
      width: "30%",
      aspectRatio: 1,
      borderRadius: BorderRadius.md,
      justifyContent: "center",
      alignItems: "center",
      padding: Spacing.sm,
    },
    docItemImage: {
      width: "100%",
      height: "100%",
      borderRadius: BorderRadius.md,
    },
    docItemPlaceholder: {
      width: "100%",
      height: "100%",
      justifyContent: "center",
      alignItems: "center",
    },
    previewModalContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.9)",
      paddingTop: insets.top,
    },
    previewModalImage: {
      width: "90%",
      height: "70%",
      borderRadius: BorderRadius.md,
    },
    previewModalClose: {
      position: "absolute",
      top: insets.top + 10,
      right: 20,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "rgba(255,255,255,0.2)",
      justifyContent: "center",
      alignItems: "center",
    },
  });

  const getRoleLabelText = () => {
    switch (user?.role) {
      case "delivery_driver":
        return "Repartidor";
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

        {/* Driver Status */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Estado del Repartidor
          </ThemedText>

          {/* Stats */}
          {driverStats && (
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <ThemedText
                  type="h3"
                  style={[styles.statValue, { color: "#FF9800" }]}
                >
                  {driverStats.rating > 0
                    ? (driverStats.rating / 10).toFixed(1)
                    : "—"}
                </ThemedText>
                <ThemedText type="caption" style={styles.statLabel}>
                  Rating
                </ThemedText>
              </View>
              <View style={styles.statCard}>
                <ThemedText
                  type="h3"
                  style={[styles.statValue, { color: ComeYaColors.primary }]}
                >
                  {driverStats.totalDeliveries}
                </ThemedText>
                <ThemedText type="caption" style={styles.statLabel}>
                  Entregas
                </ThemedText>
              </View>
              <View style={styles.statCard}>
                <Feather
                  name={
                    driverStats.verificationStatus === "verified"
                      ? "check-circle"
                      : "clock"
                  }
                  size={20}
                  color={
                    driverStats.verificationStatus === "verified"
                      ? ComeYaColors.success
                      : ComeYaColors.warning
                  }
                />
                <ThemedText
                  type="caption"
                  style={[styles.statLabel, { marginTop: 2 }]}
                >
                  {driverStats.verificationStatus === "verified"
                    ? "Verificado"
                    : "Pendiente"}
                </ThemedText>
              </View>
            </View>
          )}

          <SettingsItem
            icon="truck"
            label="Mi vehículo"
            value={getVehicleLabel()}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate("EditProfile" as any);
            }}
          />

          {/* Documentos personales */}
          <View style={styles.documentsSection}>
            <View style={styles.docHeader}>
              <Feather
                name="file-text"
                size={18}
                color={ComeYaColors.primary}
              />
              <ThemedText
                type="body"
                style={{ marginLeft: Spacing.sm, fontWeight: "600" }}
              >
                Documentos personales
              </ThemedText>
            </View>
            <View style={styles.docGrid}>
              {[
                {
                  key: "idDocumentUrl",
                  label: "DNI/NIE frente",
                  icon: "credit-card",
                  url: driverStats?.idDocumentUrl,
                },
                {
                  key: "idDocumentBackUrl",
                  label: "DNI/NIE reverso",
                  icon: "credit-card",
                  url: driverStats?.idDocumentBackUrl,
                },
                {
                  key: "autonomoDocUrl",
                  label: "Autónomo",
                  icon: "file-text",
                  url: driverStats?.autonomoDocumentUrl,
                },
              ].map((doc) => {
                const docUrl = doc.url || undefined;
                const hasDoc = !!docUrl;
                const resolvedUrl = hasDoc
                  ? resolveDocumentUrl(docUrl) || docUrl
                  : undefined;
                return (
                  <Pressable
                    key={doc.key}
                    style={[
                      styles.docItem,
                      {
                        backgroundColor: hasDoc
                          ? ComeYaColors.success + "15"
                          : theme.backgroundSecondary,
                      },
                    ]}
                    onPress={() => handlePreviewDocument(docUrl)}
                    disabled={!hasDoc}
                  >
                    {hasDoc && resolvedUrl ? (
                      <Image
                        source={{ uri: resolvedUrl }}
                        style={styles.docItemImage}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={styles.docItemPlaceholder}>
                        <Feather
                          name={doc.icon as any}
                          size={16}
                          color={theme.textSecondary}
                        />
                      </View>
                    )}
                    <ThemedText
                      type="caption"
                      style={{
                        marginTop: 4,
                        color: hasDoc
                          ? ComeYaColors.success
                          : theme.textSecondary,
                      }}
                    >
                      {hasDoc ? "Ver" : doc.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              onPress={() => navigation.navigate("EditProfile" as any)}
            >
              <ThemedText
                type="caption"
                style={{ color: ComeYaColors.primary, marginTop: Spacing.sm }}
              >
                Ver/Actualizar documentos →
              </ThemedText>
            </Pressable>
          </View>

          {/* Documentos del vehículo */}
          <View style={styles.documentsSection}>
            <View style={styles.docHeader}>
              <Feather name="truck" size={18} color={ComeYaColors.warning} />
              <ThemedText
                type="body"
                style={{ marginLeft: Spacing.sm, fontWeight: "600" }}
              >
                Documentos del vehículo
              </ThemedText>
            </View>
            <View style={styles.docGrid}>
              {[
                {
                  key: "vehiclePlatePhoto",
                  label: "Matrícula",
                  icon: "camera",
                  url: driverStats?.vehiclePlatePhoto,
                },
                {
                  key: "vehicleItvPhoto",
                  label: "ITV",
                  icon: "check-square",
                  url: driverStats?.vehicleItvPhoto,
                },
                {
                  key: "vehicleInsurancePhoto",
                  label: "Seguro",
                  icon: "shield",
                  url: driverStats?.vehicleInsurancePhoto,
                },
                {
                  key: "vehicleLicensePhoto",
                  label: "Licencia",
                  icon: "credit-card",
                  url: driverStats?.vehicleLicensePhoto,
                },
              ].map((doc) => {
                const docUrl = doc.url || undefined;
                const hasDoc = !!docUrl;
                const resolvedUrl = hasDoc
                  ? resolveDocumentUrl(docUrl) || docUrl
                  : undefined;
                return (
                  <Pressable
                    key={doc.key}
                    style={[
                      styles.docItem,
                      {
                        backgroundColor: hasDoc
                          ? ComeYaColors.success + "15"
                          : theme.backgroundSecondary,
                      },
                    ]}
                    onPress={() => handlePreviewDocument(docUrl)}
                    disabled={!hasDoc}
                  >
                    {hasDoc && resolvedUrl ? (
                      <Image
                        source={{ uri: resolvedUrl }}
                        style={styles.docItemImage}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={styles.docItemPlaceholder}>
                        <Feather
                          name={doc.icon as any}
                          size={16}
                          color={theme.textSecondary}
                        />
                      </View>
                    )}
                    <ThemedText
                      type="caption"
                      style={{
                        marginTop: 4,
                        color: hasDoc
                          ? ComeYaColors.success
                          : theme.textSecondary,
                      }}
                    >
                      {hasDoc ? "Ver" : doc.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              onPress={() => navigation.navigate("EditProfile" as any)}
            >
              <ThemedText
                type="caption"
                style={{ color: ComeYaColors.primary, marginTop: Spacing.sm }}
              >
                Ver/Actualizar documentos →
              </ThemedText>
            </Pressable>
          </View>

          {/* Strikes */}
          <View style={styles.strikesContainer}>
            <View style={{ flex: 1 }}>
              <ThemedText type="body" style={{ fontWeight: "600" }}>
                Strikes Acumulados
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {driverStrikes === 0
                  ? "Sin strikes - Excelente trabajo"
                  : driverStrikes >= maxStrikes
                    ? "Cuenta en riesgo de suspensión"
                    : `${maxStrikes - driverStrikes} strikes restantes`}
              </ThemedText>
            </View>
            <View style={styles.strikesVisual}>
              {Array.from({ length: maxStrikes }).map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.strikeIndicator,
                    {
                      backgroundColor:
                        index < driverStrikes
                          ? ComeYaColors.error
                          : theme.backgroundSecondary,
                      borderColor:
                        index < driverStrikes
                          ? ComeYaColors.error
                          : theme.border,
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        </View>

        {/* My Income */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Ganancias
          </ThemedText>

          <SettingsItem
            icon="dollar-sign"
            label="Mis ganancias"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate("DeliveryEarnings" as any);
            }}
          />
          <SettingsItem
            icon="map"
            label="Mis entregas"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate("DriverDeliveries" as any);
            }}
          />
          <SettingsItem
            icon="clock"
            label="Historial de pagos"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              showToast("Historial de pagos coming soon", "info");
            }}
          />
        </View>

        {/* Account */}
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
              showToast("Configuración de tema coming soon", "info");
            }}
          />
          <SettingsItem
            icon="bell"
            label="Notificaciones"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              showToast("Configuración de notificaciones coming soon", "info");
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
              showToast(
                "Funcionalidad de cierre de sesión coming soon",
                "info",
              );
            }}
          />
        </View>
      </ScrollView>

      {/* Image Preview Modal */}
      <Modal
        visible={showPreviewModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPreviewModal(false)}
      >
        <View style={styles.previewModalContainer}>
          {previewImage && (
            <Image
              source={{ uri: previewImage }}
              style={styles.previewModalImage}
              contentFit="contain"
            />
          )}
          <Pressable
            style={styles.previewModalClose}
            onPress={() => setShowPreviewModal(false)}
          >
            <Feather name="x" size={24} color="#fff" />
          </Pressable>
        </View>
      </Modal>
    </LinearGradient>
  );
}
