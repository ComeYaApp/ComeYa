import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Share,
  Linking,
  Modal,
  Switch,
  ActivityIndicator,
  Platform,
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
import * as FileSystem from "expo-file-system/legacy";
import * as Notifications from "expo-notifications";

import { ThemedText } from "@/components/ThemedText";
import { Badge } from "@/components/Badge";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useApp, ThemeMode } from "@/contexts/AppContext";
import { useToast } from "@/contexts/ToastContext";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest, getApiUrl } from "@/lib/query-client";

type ProfileScreenNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;

interface SettingsItemProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value?: string;
  onPress: () => void;
  danger?: boolean;
}

function SettingsItem({
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

const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "Sistema" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
];

function resolveProfileImageUrl(profileImage: string): string {
  // Base64 - devolver directamente
  if (profileImage.startsWith('data:image/')) {
    return profileImage;
  }

  const apiBase = getApiUrl().replace(/\/+$/, "");

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

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const { theme, themeMode, setThemeMode } = useTheme();
  const { settings, updateSettings } = useApp();
  const { user, logout, updateUser } = useAuth();
  const { showToast } = useToast();
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [profileImageVersion, setProfileImageVersion] = useState(0);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showAddressesModal, setShowAddressesModal] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<Notifications.PermissionStatus>("undetermined");

  const approvalStatus =
    user?.role === "business_owner" || user?.role === "delivery_driver"
      ? user?.isActive
        ? { text: "Aprobado", variant: "success" as const }
        : { text: "En revision", variant: "warning" as const }
      : null;
  const [driverStrikes, setDriverStrikes] = useState(0);
  const maxStrikes = 3;

  useEffect(() => {
    const loadDriverStatus = async () => {
      if (user?.role === "delivery_driver") {
        try {
          const response = await apiRequest("GET", "/api/delivery/status");
          const data = await response.json();
          if (data.success) {
            setDriverStrikes(data.strikes || 0);
          }
        } catch (error) {
          console.log("Error loading driver status:", error);
        }
      }
    };
    loadDriverStatus();
  }, [user?.role]);

  useEffect(() => {
    const loadProfileFromServer = async () => {
      try {
        const response = await apiRequest("GET", "/api/user/profile");
        const data = await response.json();
        if (data.success && data.user) {
          if (data.user.profileImage) {
            const img = data.user.profileImage;
            // Si es base64, usarla directamente sin añadir ?v=
            if (img.startsWith('data:image/')) {
              setProfileImage(img);
            } else {
              const version = Date.now();
              setProfileImageVersion(version);
              const baseUrl = resolveProfileImageUrl(img);
              setProfileImage(`${baseUrl}?v=${version}`);
            }
            await updateUser({ profileImage: img });
          }
        }
      } catch (error) {
        console.log("Error loading profile from server:", error);
      }
    };
    
    if (user) {
      loadProfileFromServer();
    }
  }, []);

  useEffect(() => {
    if (user?.profileImage) {
      const img = user.profileImage;
      if (img.startsWith('data:image/')) {
        setProfileImage(img);
      } else {
        const version = profileImageVersion || Date.now();
        const baseUrl = resolveProfileImageUrl(img);
        setProfileImage(`${baseUrl}?v=${version}`);
      }
    }
  }, [user?.profileImage]);

  const getThemeLabel = (mode: ThemeMode) => {
    switch (mode) {
      case "system":
        return "Sistema";
      case "light":
        return "Claro";
      case "dark":
        return "Oscuro";
      default:
        return "Sistema";
    }
  };

  const pickImage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showToast("Permisos de galería denegados", "error");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5, // reduce size to avoid backend limits
    });

    const asset = result?.assets?.[0];
    if (!result.canceled && asset?.uri) {
      await uploadImage(asset.uri);
    } else if (!result.canceled) {
      showToast("No se pudo leer la imagen seleccionada", "error");
    }
  };

  const uploadImage = async (uri: string) => {
    setIsUploadingImage(true);
    try {
      let imageData: string;
      
      if (Platform.OS === "web") {
        // On web, fetch the blob and convert to base64
        const response = await fetch(uri);
        const blob = await response.blob();
        const reader = new FileReader();
        imageData = await new Promise((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        // On native, use FileSystem
        const encoding = (FileSystem as any)?.EncodingType?.Base64 || "base64";
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding,
        });
        const extension = uri.split(".").pop()?.toLowerCase() || "jpg";
        const mimeType = extension === "png" ? "image/png" : "image/jpeg";
        imageData = `data:${mimeType};base64,${base64}`;
      }

      // Reject images larger than ~2 MB to avoid backend failures
      const estimatedBytes = Math.ceil(imageData.length * 0.75);
      if (estimatedBytes > 2 * 1024 * 1024) {
        throw new Error("La imagen es muy pesada. Usa una foto mas ligera (~2MB max)");
      }

      const apiResponse = await apiRequest("POST", "/api/user/profile-image", {
        image: imageData,
      });

      const data = await apiResponse.json();

      if (data.success && data.profileImage) {
        const img = data.profileImage;
        let fullUrl: string;
        
        if (img.startsWith('data:image/')) {
          // Base64: usar directamente, sin ?v=
          fullUrl = img;
        } else {
          const version = Date.now();
          setProfileImageVersion(version);
          fullUrl = `${resolveProfileImageUrl(img)}?v=${version}`;
        }
        
        // Force image cache clear
        setProfileImage(null);
        setTimeout(() => {
          setProfileImage(fullUrl);
        }, 100);
        
        await updateUser({ profileImage: img });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast("Imagen actualizada", "success");
      } else {
        throw new Error(data.error || "Error al subir imagen");
      }
    } catch (error: any) {
      console.error("Error uploading image:", error?.message || error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const friendly = error?.message || "No se pudo subir la imagen";
      showToast(friendly, "error");
      // Si el backend devolvió texto de error completo (ej. 400: ...), muéstralo para diagnóstico en dispositivo.
      if (error?.message && error.message.includes(":")) {
        showToast(error.message, "error");
      }
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message:
          "Descubre ComeYa - Tu delivery local de confianza en Autlan. Pide comida y productos del mercado con un toque. https://ComeYa.replit.app",
        title: "ComeYa - Delivery Local",
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const shareToSocialMedia = (platform: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const message = encodeURIComponent(
      "Descubre ComeYa - Tu delivery local de confianza en Autlan. Pide comida y productos del mercado con un toque.",
    );
    const url = encodeURIComponent("https://ComeYa.replit.app");

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
  };

  const handleLogout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowLogoutModal(false);
    await logout();
  };

  useEffect(() => {
    if (showNotificationsModal) {
      syncNotificationStatus();
    }
  }, [showNotificationsModal]);

  const syncNotificationStatus = async () => {
    try {
      const permissions = await Notifications.getPermissionsAsync();
      setNotificationStatus(permissions.status);
      return permissions.status;
    } catch (error) {
      console.error("Error consultando permisos de notificaciones", error);
      return notificationStatus;
    }
  };

  const handleThemeSelect = async (mode: ThemeMode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setThemeMode(mode);
    setShowThemeModal(false);
  };

  const handleNotificationsToggle = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (value) {
      const currentStatus = await syncNotificationStatus();
      let finalStatus = currentStatus;
      if (currentStatus !== "granted") {
        const requested = await Notifications.requestPermissionsAsync();
        finalStatus = requested.status;
        setNotificationStatus(finalStatus);
      }

      if (finalStatus !== "granted") {
        showToast("Activa permisos de notificación en ajustes del sistema", "error");
        return;
      }
      await updateSettings({ notificationsEnabled: true });
      showToast("Notificaciones activadas", "success");
    } else {
      await updateSettings({ notificationsEnabled: false });
      showToast("Notificaciones desactivadas", "info");
    }
  };

  const getRoleLabel = () => {
    switch (user?.role) {
      case "customer":
        return "Cliente";
      case "business_owner":
        return "Dueño de Negocio";
      case "delivery_driver":
        return "Repartidor";
      case "admin":
      case "super_admin":
        return "ComeYa";
      default:
        return user?.role || "Usuario";
    }
  };

  return (
    <LinearGradient
      colors={[theme.gradientStart || '#FFFFFF', theme.gradientEnd || '#F5F5F5']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Spacing.md,
            paddingBottom: Spacing.xl + Math.max(tabBarHeight, insets.bottom + 64),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.profileCard,
            { backgroundColor: theme.card },
            Shadows.md,
          ]}
        >
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
              onError={() => setProfileImage(null)}
              contentFit="cover"
            />
            {isUploadingImage ? (
              <View style={[styles.editBadge, { backgroundColor: ComeYaColors.primary }]}>
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
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            {user?.phone ? user.phone.replace(/^(\+58)+/, '+58') : "Sin teléfono"}
          </ThemedText>
          <Badge
            text={getRoleLabel()}
            variant="primary"
            style={{ marginTop: Spacing.sm }}
          />
          {approvalStatus ? (
            <Badge
              text={approvalStatus.text}
              variant={approvalStatus.variant}
              style={{ marginTop: Spacing.xs }}
            />
          ) : null}
        </View>

        <View
          style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}
        >
          <ThemedText type="h4" style={styles.sectionTitle}>
            Cuenta
          </ThemedText>
          <SettingsItem
            icon="user"
            label="Editar mi perfil"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate("EditProfile");
            }}
          />
          {user?.role === "business_owner" && (
            <>
              <SettingsItem
                icon="briefcase"
                label="Mis Negocios"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate("MyBusinesses");
                }}
              />
              <SettingsItem
                icon="clock"
                label="Horarios de atención"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate("BusinessHours");
                }}
              />
            </>
          )}
          <SettingsItem
            icon="map-pin"
            label="Direcciones guardadas"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate("SavedAddresses");
            }}
          />
          {user?.role === "business_owner" && (
            <SettingsItem
              icon="credit-card"
              label="Cuentas para recibir pagos"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate("PaymentWalletSetup" as any);
              }}
            />
          )}
          {user?.role === "customer" && (
            <SettingsItem
              icon="credit-card"
              label="Métodos de pago"
              onPress={() => navigation.navigate("PaymentWalletSetup" as any)}
            />
          )}
          {user?.role === "delivery_driver" && (
            <SettingsItem
              icon="credit-card"
              label="Cuentas para recibir pagos"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate("PaymentWalletSetup" as any);
              }}
            />
          )}
          {(user?.role === "admin" || user?.role === "super_admin") && (
            <SettingsItem
              icon="trending-up"
              label="Finanzas"
              value="Ganancias y comisiones"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate('MainTabs' as any, { screen: 'AdminTab' });
                setTimeout(() => {
                  showToast("Selecciona 'Finanzas' en el menú admin", "info");
                }, 500);
              }}
            />
          )}
        </View>

        {user?.role === "delivery_driver" && (
          <View
            style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}
          >
            <ThemedText type="h4" style={styles.sectionTitle}>
              Estado del Repartidor
            </ThemedText>
            <View style={styles.strikesContainer}>
              <View style={styles.strikesHeader}>
                <View style={styles.strikesIconContainer}>
                  <Feather 
                    name="alert-triangle" 
                    size={24} 
                    color={driverStrikes > 0 ? ComeYaColors.warning : ComeYaColors.success} 
                  />
                </View>
                <View style={styles.strikesInfo}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    Strikes Acumulados
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    {driverStrikes === 0 
                      ? "Sin strikes - Excelente trabajo" 
                      : driverStrikes >= maxStrikes 
                        ? "Cuenta en riesgo de suspensión"
                        : `${maxStrikes - driverStrikes} strikes restantes antes de suspensión`}
                  </ThemedText>
                </View>
              </View>
              <View style={styles.strikesVisual}>
                {Array.from({ length: maxStrikes }).map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.strikeIndicator,
                      {
                        backgroundColor: index < driverStrikes ? ComeYaColors.error : theme.backgroundSecondary,
                        borderColor: index < driverStrikes ? ComeYaColors.error : theme.border,
                      },
                    ]}
                  >
                    {index < driverStrikes ? (
                      <Feather name="x" size={16} color="#FFF" />
                    ) : (
                      <Feather name="check" size={16} color={ComeYaColors.success} />
                    )}
                  </View>
                ))}
              </View>
              <View style={[styles.strikeInfoCard, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="info" size={16} color={theme.textSecondary} />
                <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: Spacing.sm, flex: 1 }}>
                  Los strikes se acumulan por cancelaciones injustificadas, quejas de clientes o incumplimiento de normas. Con 3 strikes tu cuenta puede ser suspendida.
                </ThemedText>
              </View>
            </View>
          </View>
        )}

        <View
          style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}
        >
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

        <View
          style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}
        >
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
              navigation.navigate('Terms' as any);
            }}
          />
          <SettingsItem
            icon="shield"
            label="Política de privacidad"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate('Privacy' as any);
            }}
          />
        </View>

        <View
          style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}
        >
          <SettingsItem
            icon="log-out"
            label="Cerrar sesión"
            onPress={handleLogout}
            danger
          />
        </View>

        <ThemedText
          type="caption"
          style={[styles.version, { color: theme.textSecondary }]}
        >
          ComeYa v1.0.0
        </ThemedText>
      </ScrollView>

      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowLogoutModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={[styles.modalIcon, { backgroundColor: "#FFEBEE" }]}>
              <Feather name="log-out" size={28} color={ComeYaColors.error} />
            </View>
            <ThemedText type="h3" style={styles.modalTitle}>
              Cerrar sesión
            </ThemedText>
            <ThemedText
              type="body"
              style={[styles.modalMessage, { color: theme.textSecondary }]}
            >
              ¿Estás seguro que deseas cerrar sesión?
            </ThemedText>
            <View style={styles.modalButtons}>
              <Pressable
                style={[
                  styles.modalButton,
                  styles.cancelButton,
                  { borderColor: theme.border },
                ]}
                onPress={() => setShowLogoutModal(false)}
              >
                <ThemedText type="body" style={{ color: theme.text }}>
                  Cancelar
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.logoutButton]}
                onPress={confirmLogout}
              >
                <ThemedText
                  type="body"
                  style={{ color: "#FFFFFF", fontWeight: "600" }}
                >
                  Cerrar sesión
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={showThemeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowThemeModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowThemeModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View
              style={[
                styles.modalIcon,
                { backgroundColor: theme.backgroundSecondary },
              ]}
            >
              <Feather name="moon" size={28} color={ComeYaColors.primary} />
            </View>
            <ThemedText type="h3" style={styles.modalTitle}>
              Seleccionar tema
            </ThemedText>
            <View style={styles.themeOptions}>
              {themeOptions.map((option) => (
                <Pressable
                  key={option.value}
                  style={[
                    styles.themeOption,
                    {
                      backgroundColor:
                        themeMode === option.value
                          ? ComeYaColors.primaryLight
                          : theme.backgroundSecondary,
                      borderColor:
                        themeMode === option.value
                          ? ComeYaColors.primary
                          : "transparent",
                    },
                  ]}
                  onPress={() => handleThemeSelect(option.value)}
                >
                  <Feather
                    name={
                      option.value === "system"
                        ? "smartphone"
                        : option.value === "light"
                          ? "sun"
                          : "moon"
                    }
                    size={20}
                    color={
                      themeMode === option.value
                        ? ComeYaColors.primary
                        : theme.textSecondary
                    }
                  />
                  <ThemedText
                    type="body"
                    style={{
                      color:
                        themeMode === option.value
                          ? ComeYaColors.primary
                          : theme.text,
                      marginLeft: Spacing.sm,
                      fontWeight: themeMode === option.value ? "600" : "400",
                    }}
                  >
                    {option.label}
                  </ThemedText>
                  {themeMode === option.value ? (
                    <Feather
                      name="check"
                      size={20}
                      color={ComeYaColors.primary}
                      style={{ marginLeft: "auto" }}
                    />
                  ) : null}
                </Pressable>
              ))}
            </View>
            <Pressable
              style={[
                styles.modalButtonFull,
                { backgroundColor: theme.backgroundSecondary },
              ]}
              onPress={() => setShowThemeModal(false)}
            >
              <ThemedText type="body" style={{ color: theme.text }}>
                Cerrar
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={showNotificationsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNotificationsModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowNotificationsModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View
              style={[
                styles.modalIcon,
                { backgroundColor: theme.backgroundSecondary },
              ]}
            >
              <Feather name="bell" size={28} color={ComeYaColors.primary} />
            </View>
            <ThemedText type="h3" style={styles.modalTitle}>
              Notificaciones
            </ThemedText>
            <ThemedText
              type="body"
              style={[styles.modalMessage, { color: theme.textSecondary }]}
            >
              Recibe alertas sobre tus pedidos y promociones especiales. Si el permiso está bloqueado, debes activarlo en la configuración del sistema.
            </ThemedText>
            <View style={[styles.strikeInfoCard, { backgroundColor: theme.backgroundSecondary, marginBottom: Spacing.md }]}>
              <Feather name="info" size={16} color={theme.textSecondary} />
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: Spacing.sm, flex: 1 }}>
                Estado del permiso: {notificationStatus === "granted" ? "Permitido" : notificationStatus === "denied" ? "Bloqueado" : "Sin solicitar"}
              </ThemedText>
            </View>
            <View style={styles.switchRow}>
              <ThemedText type="body" style={{ color: theme.text }}>
                Activar notificaciones
              </ThemedText>
              <Switch
                value={settings.notificationsEnabled}
                onValueChange={handleNotificationsToggle}
                trackColor={{
                  false: theme.border,
                  true: ComeYaColors.primaryLight,
                }}
                thumbColor={
                  settings.notificationsEnabled ? ComeYaColors.primary : "#f4f3f4"
                }
              />
            </View>
            {notificationStatus === "denied" ? (
              <Pressable
                style={[styles.modalButtonFull, { backgroundColor: theme.backgroundSecondary, borderWidth: 1, borderColor: theme.border, marginTop: Spacing.sm }]}
                onPress={() => Linking.openSettings()}
              >
                <ThemedText type="body" style={{ color: theme.text }}>
                  Abrir ajustes del sistema
                </ThemedText>
              </Pressable>
            ) : null}
            <Pressable
              style={[
                styles.modalButtonFull,
                { backgroundColor: ComeYaColors.primary },
              ]}
              onPress={() => setShowNotificationsModal(false)}
            >
              <ThemedText
                type="body"
                style={{ color: "#FFFFFF", fontWeight: "600" }}
              >
                Listo
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={showLanguageModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowLanguageModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View
              style={[
                styles.modalIcon,
                { backgroundColor: theme.backgroundSecondary },
              ]}
            >
              <Feather name="globe" size={28} color={ComeYaColors.primary} />
            </View>
            <ThemedText type="h3" style={styles.modalTitle}>
              Idioma
            </ThemedText>
            <View style={styles.themeOptions}>
              <View
                style={[
                  styles.themeOption,
                  {
                    backgroundColor: ComeYaColors.primaryLight,
                    borderColor: ComeYaColors.primary,
                  },
                ]}
              >
                <ThemedText
                  type="body"
                  style={{ color: ComeYaColors.primary, fontWeight: "600" }}
                >
                  Español
                </ThemedText>
                <Feather
                  name="check"
                  size={20}
                  color={ComeYaColors.primary}
                  style={{ marginLeft: "auto" }}
                />
              </View>
            </View>
            <ThemedText
              type="small"
              style={[styles.comingSoon, { color: theme.textSecondary }]}
            >
              Más idiomas próximamente...
            </ThemedText>
            <Pressable
              style={[
                styles.modalButtonFull,
                { backgroundColor: theme.backgroundSecondary },
              ]}
              onPress={() => setShowLanguageModal(false)}
            >
              <ThemedText type="body" style={{ color: theme.text }}>
                Cerrar
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={showTermsModal}
        animationType="slide"
        onRequestClose={() => setShowTermsModal(false)}
      >
        <View
          style={[
            styles.fullScreenModal,
            { backgroundColor: theme.backgroundRoot, paddingTop: insets.top },
          ]}
        >
          <View
            style={[
              styles.fullScreenHeader,
              { borderBottomColor: theme.border },
            ]}
          >
            <ThemedText type="h3">Términos y condiciones</ThemedText>
            <Pressable
              style={[
                styles.closeButton,
                { backgroundColor: theme.backgroundSecondary },
              ]}
              onPress={() => setShowTermsModal(false)}
            >
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.fullScreenContent}
            contentContainerStyle={{
              padding: Spacing.lg,
              paddingBottom: insets.bottom + Spacing.xl,
            }}
          >
            <ThemedText type="h4" style={styles.legalTitle}>
              Ultima actualizacion: Febrero 2026
            </ThemedText>
            
            <ThemedText type="body" style={styles.legalText}>
              Bienvenido a ComeYa. Al utilizar nuestra aplicacion, aceptas estos terminos y condiciones. Por favor, leelos cuidadosamente.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              1. Aceptacion de Terminos
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Al descargar, instalar o usar la aplicacion ComeYa, confirmas que has leido, entendido y aceptas estar sujeto a estos Terminos y Condiciones. Si no estas de acuerdo, no uses la aplicacion.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              2. Descripcion del Servicio
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              ComeYa es una plataforma de delivery local que conecta a clientes con negocios locales y repartidores en Soria, España, España. Facilitamos la compra y entrega de alimentos, productos de mercado y otros articulos de negocios participantes.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              3. Registro y Cuenta
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Para usar ComeYa debes registrarte con un numero de telefono valido. Eres responsable de mantener la confidencialidad de tu cuenta y de todas las actividades que ocurran bajo ella. Debes proporcionar informacion veraz y actualizada.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              4. Pedidos y Pagos
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Los precios mostrados incluyen IVA. Los cargos de envio se calculan segun la distancia y se muestran antes de confirmar tu pedido. Aceptamos pagos con tarjeta de credito/debito y efectivo. Los pedidos pueden cancelarse sin penalizacion dentro de los primeros 60 segundos.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              5. Entregas
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Los tiempos de entrega son estimados y pueden variar segun la demanda, condiciones climaticas y trafico. ComeYa no se hace responsable por retrasos fuera de nuestro control. Debes estar disponible para recibir tu pedido en la direccion indicada.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              6. Cancelaciones y Reembolsos
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Puedes cancelar tu pedido sin cargo dentro de los primeros 60 segundos. Despues de este periodo, pueden aplicar cargos segun el estado del pedido. Los reembolsos se procesan en 5-10 dias habiles al metodo de pago original.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              7. Conducta del Usuario
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Te comprometes a usar ComeYa de manera responsable y respetuosa. Esta prohibido el uso fraudulento, el acoso a repartidores o negocios, y cualquier actividad ilegal. ComeYa se reserva el derecho de suspender cuentas que violen estas normas.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              8. Limitacion de Responsabilidad
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              ComeYa actua como intermediario entre clientes, negocios y repartidores. No somos responsables por la calidad de los productos, alergenos no declarados, o problemas de salud derivados del consumo. Los negocios son responsables de la preparacion y calidad de sus productos.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              9. Modificaciones
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              ComeYa puede modificar estos terminos en cualquier momento. Te notificaremos de cambios significativos. El uso continuado de la aplicacion constituye aceptacion de los nuevos terminos.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              10. Contacto
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Para dudas o comentarios sobre estos terminos, contactanos a traves de la seccion de Ayuda y Soporte en la aplicacion o al correo soporte@ComeYa.mx
            </ThemedText>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showPrivacyModal}
        animationType="slide"
        onRequestClose={() => setShowPrivacyModal(false)}
      >
        <View
          style={[
            styles.fullScreenModal,
            { backgroundColor: theme.backgroundRoot, paddingTop: insets.top },
          ]}
        >
          <View
            style={[
              styles.fullScreenHeader,
              { borderBottomColor: theme.border },
            ]}
          >
            <ThemedText type="h3">Politica de privacidad</ThemedText>
            <Pressable
              style={[
                styles.closeButton,
                { backgroundColor: theme.backgroundSecondary },
              ]}
              onPress={() => setShowPrivacyModal(false)}
            >
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.fullScreenContent}
            contentContainerStyle={{
              padding: Spacing.lg,
              paddingBottom: insets.bottom + Spacing.xl,
            }}
          >
            <ThemedText type="h4" style={styles.legalTitle}>
              Ultima actualizacion: Febrero 2026
            </ThemedText>

            <ThemedText type="body" style={styles.legalText}>
              En ComeYa, tu privacidad es nuestra prioridad. Esta politica describe como recopilamos, usamos y protegemos tu informacion personal.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              1. Informacion que Recopilamos
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Recopilamos: nombre, numero de telefono, direcciones de entrega, historial de pedidos, datos de pago (procesados de forma segura por Stripe), ubicacion (solo cuando usas la app), y preferencias de usuario.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              2. Uso de la Informacion
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Usamos tu informacion para: procesar y entregar tus pedidos, verificar tu identidad, procesar pagos, enviarte notificaciones sobre tus pedidos, mejorar nuestros servicios, cumplir con obligaciones legales, y comunicarnos contigo sobre promociones (con tu consentimiento).
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              3. Compartir Informacion
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Compartimos informacion limitada con: negocios (nombre y direccion para preparar y entregar pedidos), repartidores (nombre, telefono y direccion de entrega), procesadores de pago (Stripe), y autoridades cuando la ley lo requiera.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              4. Seguridad de Datos
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Implementamos medidas de seguridad incluyendo: encriptacion de datos en transito y reposo, autenticacion de dos factores via SMS, almacenamiento seguro de contrasenas, y acceso restringido a datos personales.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              5. Tus Derechos
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Tienes derecho a: acceder a tus datos personales, corregir informacion inexacta, solicitar la eliminacion de tu cuenta y datos, oponerte al procesamiento de tus datos, y retirar tu consentimiento para comunicaciones promocionales.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              6. Retencion de Datos
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Conservamos tus datos mientras tu cuenta este activa y por el periodo requerido por ley. Puedes solicitar la eliminacion de tu cuenta contactando a soporte.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              7. Cookies y Tecnologias Similares
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Usamos cookies y tecnologias similares para mejorar tu experiencia, recordar preferencias, y analizar el uso de la aplicacion.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              8. Menores de Edad
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              ComeYa no esta dirigido a menores de 18 anios. No recopilamos intencionalmente informacion de menores. Si eres padre y crees que tu hijo ha proporcionado informacion, contactanos.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              9. Cambios a esta Politica
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Podemos actualizar esta politica periodicamente. Te notificaremos de cambios significativos a traves de la aplicacion o por SMS.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              10. Contacto
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Para ejercer tus derechos o resolver dudas sobre privacidad, contactanos a traves de Ayuda y Soporte o al correo privacidad@ComeYa.mx
            </ThemedText>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showEditProfileModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditProfileModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowEditProfileModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View
              style={[
                styles.modalIcon,
                { backgroundColor: theme.backgroundSecondary },
              ]}
            >
              <Feather name="user" size={28} color={ComeYaColors.primary} />
            </View>
            <ThemedText type="h3" style={styles.modalTitle}>
              Editar perfil
            </ThemedText>
            <ThemedText
              type="body"
              style={[styles.modalMessage, { color: theme.textSecondary }]}
            >
              Esta función estará disponible próximamente. Podrás editar tu
              nombre, foto y datos personales.
            </ThemedText>
            <Pressable
              style={[
                styles.modalButtonFull,
                { backgroundColor: ComeYaColors.primary },
              ]}
              onPress={() => setShowEditProfileModal(false)}
            >
              <ThemedText
                type="body"
                style={{ color: "#FFFFFF", fontWeight: "600" }}
              >
                Entendido
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={showAddressesModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddressesModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowAddressesModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View
              style={[
                styles.modalIcon,
                { backgroundColor: theme.backgroundSecondary },
              ]}
            >
              <Feather name="map-pin" size={28} color={ComeYaColors.primary} />
            </View>
            <ThemedText type="h3" style={styles.modalTitle}>
              Direcciones guardadas
            </ThemedText>
            <ThemedText
              type="body"
              style={[styles.modalMessage, { color: theme.textSecondary }]}
            >
              Esta función estará disponible próximamente. Podrás gestionar tus
              direcciones de entrega favoritas.
            </ThemedText>
            <Pressable
              style={[
                styles.modalButtonFull,
                { backgroundColor: ComeYaColors.primary },
              ]}
              onPress={() => setShowAddressesModal(false)}
            >
              <ThemedText
                type="body"
                style={{ color: "#FFFFFF", fontWeight: "600" }}
              >
                Entendido
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
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
  section: {
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    overflow: "hidden",
  },
  sectionTitle: {
    padding: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
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
  version: {
    textAlign: "center",
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
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
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  comingSoon: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
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
  placeholderCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  legalTitle: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  legalText: {
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  strikesContainer: {
    padding: Spacing.lg,
    paddingTop: 0,
  },
  strikesHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  strikesIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 152, 0, 0.1)",
    marginRight: Spacing.md,
  },
  strikesInfo: {
    flex: 1,
  },
  strikesVisual: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  strikeIndicator: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
  },
  strikeInfoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
});
