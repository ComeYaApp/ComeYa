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
  TextInput,
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
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { useQuery } from "@tanstack/react-query";

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
  if (profileImage.startsWith("data:image/")) {
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
  const [subscription, setSubscription] = useState<any>(null);
  const [editTab, setEditTab] = useState<"datos" | "seguridad" | "profesion">(
    "datos",
  );

  // Professional data for drivers/business owners
  const [professionalData, setProfessionalData] = useState<{
    vehicleType: string | null;
    vehiclePlate: string | null;
    vehicleBrand: string | null;
    vehicleModel: string | null;
    vehicleColor: string | null;
    vehicleYear: string | null;
    vehiclePhoto: string | null;
    vehiclePlatePhoto: string | null;
    vehicleItvPhoto: string | null;
    vehicleInsurancePhoto: string | null;
    vehicleLicensePhoto: string | null;
    idDocumentUrl: string | null;
    idDocumentBackUrl: string | null;
    autonomoDocumentUrl: string | null;
  } | null>(null);
  const [editName, setEditName] = useState(user?.name || "");
  const [editEmail, setEditEmail] = useState(user?.email || "");
  const [editDni, setEditDni] = useState((user as any)?.dni || "");
  const [editCurrentPassword, setEditCurrentPassword] = useState("");
  const [editNewPassword, setEditNewPassword] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [notificationStatus, setNotificationStatus] =
    useState<Notifications.PermissionStatus>(
      "undetermined" as Notifications.PermissionStatus,
    );

  const approvalStatus =
    user?.role === "business_owner" || user?.role === "delivery_driver"
      ? user?.isActive
        ? { text: "Aprobado", variant: "success" as const }
        : { text: "En revision", variant: "warning" as const }
      : null;
  const [driverStrikes, setDriverStrikes] = useState(0);
  const maxStrikes = 3;
  const [driverStats, setDriverStats] = useState<{
    rating: number;
    totalDeliveries: number;
    vehicleType: string | null;
    vehiclePlate: string | null;
    verificationStatus: string;
  } | null>(null);

  // Vehicle editing state
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({
    vehicleType: "",
    vehicleBrand: "",
    vehicleModel: "",
    vehiclePlate: "",
    vehicleColor: "",
  });
  const [isSavingVehicle, setIsSavingVehicle] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState<string | null>(
    null,
  );

  // Upload document image
  const uploadDocument = async (documentType: string, uri: string) => {
    setUploadingDocument(documentType);
    try {
      let imageData: string;

      if (Platform.OS === "web") {
        const response = await fetch(uri);
        const blob = await response.blob();
        const reader = new FileReader();
        imageData = await new Promise((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        const encoding = (FileSystem as any)?.EncodingType?.Base64 || "base64";
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding });
        const extension = uri.split(".").pop()?.toLowerCase() || "jpg";
        const mimeType = extension === "png" ? "image/png" : "image/jpeg";
        imageData = `data:${mimeType};base64,${base64}`;
      }

      const estimatedBytes = Math.ceil(imageData.length * 0.75);
      if (estimatedBytes > 2 * 1024 * 1024) {
        throw new Error(
          "La imagen es muy pesada. Usa una foto mas ligera (~2MB max)",
        );
      }

      const apiResponse = await apiRequest(
        "POST",
        "/api/users/verification-document",
        {
          key: documentType,
          image: imageData,
        },
      );

      const data = await apiResponse.json();
      if (data.success) {
        // Update local professional data with the URL from server (Cloudinary URL)
        const fieldMap: Record<string, string> = {
          idDocument: "idDocumentUrl",
          idDocumentBack: "idDocumentBackUrl",
          autonomo: "autonomoDocumentUrl",
          vehicleLicense: "vehicleLicensePhoto",
          vehiclePlate: "vehiclePlatePhoto",
          vehicleItv: "vehicleItvPhoto",
          vehicleInsurance: "vehicleInsurancePhoto",
          vehiclePhoto: "vehiclePhoto",
        };
        const field = fieldMap[documentType];
        if (field) {
          // Use the Cloudinary URL returned by server, not the base64
          setProfessionalData((prev) =>
            prev ? { ...prev, [field]: data.url } : null,
          );
        }

        // Note: Server now handles verification status reset automatically
        // Do NOT call reset-verification here - it would cause unnecessary reset

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast(data.message || "Documento actualizado", "success");
      } else {
        throw new Error(data.error || "Error al subir documento");
      }
    } catch (error: any) {
      console.error("Error uploading document:", error?.message || error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast(error?.message || "No se pudo subir el documento", "error");
    } finally {
      setUploadingDocument(null);
    }
  };

  const pickDocumentImage = async (documentType: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const { fileToBase64 } = await import("@/utils/uploadImageWeb");
        const base64 = await fileToBase64(file);
        await uploadDocument(documentType, URL.createObjectURL(file));
      };
      input.click();
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showToast("Permisos de galer�a denegados", "error");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.5,
    });

    const asset = result?.assets?.[0];
    if (!result.canceled && asset?.uri) {
      await uploadDocument(documentType, asset.uri);
    } else if (!result.canceled) {
      showToast("No se pudo leer la imagen seleccionada", "error");
    }
  };

  // Document preview modal state
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

  // Document upload button component with image preview
  const DocumentUploadButton = ({
    documentType,
    label,
    currentUrl,
  }: {
    documentType: string;
    label: string;
    currentUrl: string | null | undefined;
  }) => {
    const isUploading = uploadingDocument === documentType;
    const hasDocument = !!currentUrl;
    const documentImageUrl = resolveDocumentUrl(currentUrl);

    return (
      <View style={{ marginBottom: Spacing.md }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: Spacing.xs,
          }}
        >
          {hasDocument ? (
            <Feather
              name="check-circle"
              size={16}
              color={ComeYaColors.success}
            />
          ) : (
            <Feather name="circle" size={16} color={theme.textSecondary} />
          )}
          <ThemedText
            type="body"
            style={{ marginLeft: Spacing.xs, color: theme.text }}
          >
            {label}
          </ThemedText>
        </View>

        {/* Document thumbnail preview */}
        {hasDocument && documentImageUrl ? (
          <Pressable
            onPress={() => {
              setPreviewImage(documentImageUrl);
              setShowPreviewModal(true);
            }}
            style={{ marginBottom: Spacing.sm }}
          >
            <Image
              source={{ uri: documentImageUrl }}
              style={{
                width: "100%",
                height: 120,
                borderRadius: BorderRadius.md,
              }}
              contentFit="cover"
            />
            <View
              style={{
                position: "absolute",
                bottom: 8,
                right: 8,
                backgroundColor: "rgba(0,0,0,0.6)",
                borderRadius: 12,
                paddingHorizontal: 8,
                paddingVertical: 4,
              }}
            >
              <Feather name="maximize-2" size={14} color="#fff" />
            </View>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => pickDocumentImage(documentType)}
          disabled={isUploading}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            padding: Spacing.sm,
            borderRadius: BorderRadius.md,
            backgroundColor: isUploading
              ? theme.backgroundSecondary
              : ComeYaColors.primaryLight,
            borderWidth: 1,
            borderColor: isUploading ? theme.border : ComeYaColors.primary,
          }}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color={ComeYaColors.primary} />
          ) : (
            <>
              <Feather
                name={hasDocument ? "refresh-cw" : "upload"}
                size={16}
                color={ComeYaColors.primary}
              />
              <ThemedText
                type="caption"
                style={{ color: ComeYaColors.primary, marginLeft: Spacing.xs }}
              >
                {hasDocument ? "Actualizar" : "Subir"}
              </ThemedText>
            </>
          )}
        </Pressable>
      </View>
    );
  };

  const { data: subscriptionData } = useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: async () => {
      try {
        const res = await apiRequest(
          "GET",
          "/api/subscriptions/my-subscription",
        );
        const data = await res.json();
        return data.success ? data.subscription : null;
      } catch {
        return null;
      }
    },
    enabled: !!user?.id,
  });

  // Update local state when query data changes
  useEffect(() => {
    setSubscription(subscriptionData);
  }, [subscriptionData]);

  const saveProfile = async () => {
    if (!editName.trim()) {
      showToast("El nombre es requerido", "error");
      return;
    }
    setIsSavingProfile(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const isDriverOrBusiness =
        user?.role === "delivery_driver" || user?.role === "business_owner";

      const res = await apiRequest("PUT", "/api/users/profile", {
        name: editName.trim(),
        email: editEmail.trim(),
        dni: editDni.trim(),
      });
      const data = await res.json();
      if (data.success || data.user) {
        // Si es driver o negocio,resetear verificaci�n si cambi� informaci�n cr�tica (DNI)
        if (isDriverOrBusiness && editDni.trim()) {
          try {
            await apiRequest(
              "POST",
              `/api/users/${user?.id}/reset-verification`,
            );
            showToast(
              "Perfil actualizado. Tu verificaci�n est� en revisi�n.",
              "success",
            );
          } catch {
            showToast(
              "Perfil actualizado. Contacta soporte para re-verificar.",
              "warning",
            );
          }
        } else {
          await updateUser({ name: editName.trim(), email: editEmail.trim() });
          showToast("Perfil actualizado correctamente", "success");
        }
        setShowEditProfileModal(false);
      } else {
        showToast(data.message || "Error al actualizar perfil", "error");
      }
    } catch {
      showToast("Error de conexi�n", "error");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const changePassword = async () => {
    if (!editCurrentPassword || !editNewPassword) {
      showToast("Completa todos los campos", "error");
      return;
    }
    if (editNewPassword.length < 6) {
      showToast(
        "La nueva contrase�a debe tener al menos 6 caracteres",
        "error",
      );
      return;
    }
    setIsSavingProfile(true);
    try {
      const res = await apiRequest("PUT", "/api/auth/change-password", {
        currentPassword: editCurrentPassword,
        newPassword: editNewPassword,
      });
      const data = await res.json();
      if (data.success) {
        showToast("Contrase�a cambiada correctamente", "success");
        setEditCurrentPassword("");
        setEditNewPassword("");
        setShowEditProfileModal(false);
      } else {
        showToast(data.message || "Error al cambiar contrase�a", "error");
      }
    } catch {
      showToast("Error de conexi�n", "error");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const saveVehicle = async () => {
    if (!vehicleForm.vehicleType) {
      showToast("Selecciona un tipo de veh�culo", "error");
      return;
    }
    setIsSavingVehicle(true);
    try {
      const res = await apiRequest("PUT", "/api/users/vehicle", {
        vehicleType: vehicleForm.vehicleType,
        vehicleBrand: vehicleForm.vehicleBrand.trim() || null,
        vehicleModel: vehicleForm.vehicleModel.trim() || null,
        vehiclePlate: vehicleForm.vehiclePlate.trim().toUpperCase() || null,
        vehicleColor: vehicleForm.vehicleColor.trim() || null,
      });
      const data = await res.json();
      if (data.success) {
        showToast("Veh�culo guardado", "success");
        setShowVehicleModal(false);
        // Actualizar driverStats local
        setDriverStats((prev) =>
          prev
            ? {
                ...prev,
                vehicleType: vehicleForm.vehicleType,
                vehiclePlate: vehicleForm.vehiclePlate.trim().toUpperCase(),
              }
            : null,
        );
      } else {
        showToast(data.message || "Error al guardar veh�culo", "error");
      }
    } catch {
      showToast("Error de conexi�n", "error");
    } finally {
      setIsSavingVehicle(false);
    }
  };

  useEffect(() => {
    const loadDriverStatus = async () => {
      if (user?.role === "delivery_driver") {
        try {
          const [statusRes, profileRes] = await Promise.all([
            apiRequest("GET", "/api/delivery/status"),
            apiRequest("GET", "/api/users/profile/full"),
          ]);
          const statusData = await statusRes.json();
          const profileData = await profileRes.json();
          if (statusData.success) setDriverStrikes(statusData.strikes || 0);
          if (profileData.success) {
            setDriverStats({
              rating: statusData.rating || 0,
              totalDeliveries: statusData.totalDeliveries || 0,
              vehicleType: profileData.vehicleType,
              vehiclePlate: profileData.vehiclePlate,
              verificationStatus: user?.isActive ? "verified" : "pending",
            });
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
            // Si es base64, usarla directamente sin a�adir ?v=
            if (img.startsWith("data:image/")) {
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
      if (img.startsWith("data:image/")) {
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

    // Web: usar input file directo
    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const { fileToBase64 } = await import("@/utils/uploadImageWeb");
        const base64 = await fileToBase64(file);
        await uploadImage(URL.createObjectURL(file));
      };
      input.click();
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showToast("Permisos de galer�a denegados", "error");
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
        throw new Error(
          "La imagen es muy pesada. Usa una foto mas ligera (~2MB max)",
        );
      }

      const apiResponse = await apiRequest("POST", "/api/user/profile-image", {
        image: imageData,
      });

      const data = await apiResponse.json();

      if (data.success && data.profileImage) {
        const img = data.profileImage;
        let fullUrl: string;

        if (img.startsWith("data:image/")) {
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
      // Si el backend devolvi� texto de error completo (ej. 400: ...), mu�stralo para diagn�stico en dispositivo.
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
          "Descubre ComeYa - Tu delivery local de confianza en Soria. Pide comida y productos del mercado con un toque. https://app.comeya.es",
        title: "ComeYa - Delivery en Soria",
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const shareToSocialMedia = (platform: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const message = encodeURIComponent(
      "Descubre ComeYa - Tu delivery local de confianza en Soria. Pide comida y productos del mercado con un toque.",
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
      console.log("No se pudo abrir la aplicaci�n");
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

  // Load professional data when edit modal opens (for drivers/business owners)
  useEffect(() => {
    if (
      showEditProfileModal &&
      (user?.role === "delivery_driver" || user?.role === "business_owner")
    ) {
      const loadProfessionalData = async () => {
        try {
          const res = await apiRequest("GET", "/api/users/profile/full");
          const data = await res.json();
          if (data.success) {
            setProfessionalData({
              vehicleType: data.vehicleType,
              vehiclePlate: data.vehiclePlate,
              vehicleBrand: data.vehicleBrand,
              vehicleModel: data.vehicleModel,
              vehicleColor: data.vehicleColor,
              vehicleYear: data.vehicleYear,
              vehiclePhoto: data.vehiclePhoto,
              vehiclePlatePhoto: data.vehiclePlatePhoto,
              vehicleItvPhoto: data.vehicleItvPhoto,
              vehicleInsurancePhoto: data.vehicleInsurancePhoto,
              vehicleLicensePhoto: data.vehicleLicensePhoto,
              idDocumentUrl: data.idDocumentUrl,
              idDocumentBackUrl: data.idDocumentBackUrl,
              autonomoDocumentUrl: data.autonomoDocumentUrl,
            });
            // Pre-fill vehicleForm from professional data (for profesion tab)
            if (data.vehicleType) {
              setVehicleForm({
                vehicleType: data.vehicleType || "",
                vehicleBrand: data.vehicleBrand || "",
                vehicleModel: data.vehicleModel || "",
                vehiclePlate: data.vehiclePlate || "",
                vehicleColor: data.vehicleColor || "",
              });
            }
          }
        } catch (error) {
          console.log("Error loading professional data:", error);
        }
      };
      loadProfessionalData();
    }
  }, [showEditProfileModal, user?.role]);

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
        showToast(
          "Activa permisos de notificaci�n en ajustes del sistema",
          "error",
        );
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
        return "Due�o de Negocio";
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
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Spacing.md,
            paddingBottom:
              Spacing.xl + Math.max(tabBarHeight, insets.bottom + 64),
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
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            {user?.phone || "Sin tel�fono"}
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
          {subscription &&
            subscription.status === "active" &&
            subscription.plan !== "free" &&
            (user?.role === "customer" || user?.role === "business_owner") && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: Spacing.sm,
                  backgroundColor: ComeYaColors.primary + "18",
                  borderRadius: 20,
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                }}
              >
                <Feather name="star" size={13} color={ComeYaColors.primary} />
                 <ThemedText
                   type="caption"
                   style={{
                     color: ComeYaColors.primary,
                     fontWeight: "700",
                     marginLeft: 4,
                   }}
                 >
                    {subscription.plan === "premium" ? "Premium" : subscription.plan === "business" ? "Business" : "Premium"} activo
                 </ThemedText>
              </View>
            )}
          {subscription &&
            subscription.status === "pending_payment" &&
            (user?.role === "customer" || user?.role === "business_owner") && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: Spacing.sm,
                  backgroundColor: "#F59E0B18",
                  borderRadius: 20,
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                }}
              >
                <Feather name="clock" size={13} color="#F59E0B" />
                 <ThemedText
                   type="caption"
                   style={{
                     color: "#F59E0B",
                     fontWeight: "700",
                     marginLeft: 4,
                   }}
                 >
                    {subscription.plan === "premium" ? "Premium" : subscription.plan === "business" ? "Business" : "Premium"} pendiente
                 </ThemedText>
              </View>
            )}
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
              // Open modal for profile editing
              setShowEditProfileModal(true);
            }}
          />
          {user?.role === "business_owner" && (
            <>
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
                label="Horarios de atenci�n"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate("BusinessHours" as any);
                }}
              />
              <SettingsItem
                icon="star"
                label="Suscripciones"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate("Subscriptions" as any);
                }}
              />
              <SettingsItem
                icon="credit-card"
                label="M�todos de pago"
                onPress={() => navigation.navigate("PaymentWalletSetup" as any)}
              />
            </>
          )}
          {/* Secci�n cliente: features avanzadas */}
          {user?.role === "customer" && (
            <>
              <SettingsItem
                icon="map-pin"
                label="Direcciones guardadas"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate("SavedAddresses");
                }}
              />
              <SettingsItem
                icon="credit-card"
                label="M�todos de pago"
                value="Bizum � Tarjeta � PayPal"
                onPress={() => navigation.navigate("PaymentWalletSetup" as any)}
              />
              <SettingsItem
                icon="gift"
                label="Mis puntos y recompensas"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate("Gamification" as any);
                }}
              />
              <SettingsItem
                icon="star"
                label="Suscripciones"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate("Subscriptions" as any);
                }}
              />
              <SettingsItem
                icon="tag"
                label="Mis Gift Cards"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate("GiftCards" as any);
                }}
              />
              <SettingsItem
                icon="users"
                label="Pedido grupal"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate("GroupOrder" as any);
                }}
              />
              <SettingsItem
                icon="clock"
                label="Pedidos programados"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate("ScheduledOrders" as any);
                }}
              />
            </>
          )}
        </View>

        {user?.role === "delivery_driver" && (
          <View
            style={[
              styles.section,
              { backgroundColor: theme.card },
              Shadows.sm,
            ]}
          >
            <ThemedText type="h4" style={styles.sectionTitle}>
              Estado del Repartidor
            </ThemedText>

            {/* Stats r�pidas */}
            {driverStats && (
              <View
                style={{
                  flexDirection: "row",
                  gap: 10,
                  paddingHorizontal: Spacing.lg,
                  marginBottom: Spacing.md,
                }}
              >
                <View
                  style={{
                    flex: 1,
                    backgroundColor: theme.backgroundSecondary,
                    borderRadius: 12,
                    padding: 12,
                    alignItems: "center",
                  }}
                >
                  <ThemedText type="h3" style={{ color: "#FF9800" }}>
                    {driverStats.rating > 0
                      ? (driverStats.rating / 10).toFixed(1)
                      : "�"}
                  </ThemedText>
                  <ThemedText
                    type="caption"
                    style={{ color: theme.textSecondary }}
                  >
                    Rating
                  </ThemedText>
                </View>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: theme.backgroundSecondary,
                    borderRadius: 12,
                    padding: 12,
                    alignItems: "center",
                  }}
                >
                  <ThemedText type="h3" style={{ color: ComeYaColors.primary }}>
                    {driverStats.totalDeliveries}
                  </ThemedText>
                  <ThemedText
                    type="caption"
                    style={{ color: theme.textSecondary }}
                  >
                    Entregas
                  </ThemedText>
                </View>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: theme.backgroundSecondary,
                    borderRadius: 12,
                    padding: 12,
                    alignItems: "center",
                  }}
                >
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
                    style={{ color: theme.textSecondary, marginTop: 2 }}
                  >
                    {driverStats.verificationStatus === "verified"
                      ? "Verificado"
                      : "Pendiente"}
                  </ThemedText>
                </View>
              </View>
            )}

            {/* Veh�culo */}
            <SettingsItem
              icon="truck"
              label="Mi veh�culo"
              value={
                driverStats?.vehicleType
                  ? `${driverStats.vehicleType === "car" ? "Coche" : driverStats.vehicleType === "motorcycle" ? "Moto" : "Bicicleta"}${driverStats?.vehiclePlate ? ` � ${driverStats.vehiclePlate}` : ""}`
                  : "No registrado"
              }
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                // Pre-fill form with existing data
                setVehicleForm({
                  vehicleType: driverStats?.vehicleType || "",
                  vehicleBrand: "",
                  vehicleModel: "",
                  vehiclePlate: driverStats?.vehiclePlate || "",
                  vehicleColor: "",
                });
                setShowVehicleModal(true);
              }}
            />
            <View style={styles.strikesContainer}>
              <View style={styles.strikesHeader}>
                <View style={styles.strikesIconContainer}>
                  <Feather
                    name="alert-triangle"
                    size={24}
                    color={
                      driverStrikes > 0
                        ? ComeYaColors.warning
                        : ComeYaColors.success
                    }
                  />
                </View>
                <View style={styles.strikesInfo}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    Strikes Acumulados
                  </ThemedText>
                  <ThemedText
                    type="caption"
                    style={{ color: theme.textSecondary }}
                  >
                    {driverStrikes === 0
                      ? "Sin strikes - Excelente trabajo"
                      : driverStrikes >= maxStrikes
                        ? "Cuenta en riesgo de suspensi�n"
                        : `${maxStrikes - driverStrikes} strikes restantes antes de suspensi�n`}
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
                  >
                    {index < driverStrikes ? (
                      <Feather name="x" size={16} color="#FFF" />
                    ) : (
                      <Feather
                        name="check"
                        size={16}
                        color={ComeYaColors.success}
                      />
                    )}
                  </View>
                ))}
              </View>
              <View
                style={[
                  styles.strikeInfoCard,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <Feather name="info" size={16} color={theme.textSecondary} />
                <ThemedText
                  type="caption"
                  style={{
                    color: theme.textSecondary,
                    marginLeft: Spacing.sm,
                    flex: 1,
                  }}
                >
                  Los strikes se acumulan por cancelaciones injustificadas,
                  quejas de clientes o incumplimiento de normas. Con 3 strikes
                  tu cuenta puede ser suspendida.
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
            value="Espa�ol"
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
            M�s
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
            label="T�rminos y condiciones"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowTermsModal(true);
            }}
          />
          <SettingsItem
            icon="shield"
            label="Pol�tica de privacidad"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowPrivacyModal(true);
            }}
          />
        </View>

        <View
          style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}
        >
          <SettingsItem
            icon="log-out"
            label="Cerrar sesi�n"
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
              Cerrar sesi�n
            </ThemedText>
            <ThemedText
              type="body"
              style={[styles.modalMessage, { color: theme.textSecondary }]}
            >
              �Est�s seguro que deseas cerrar sesi�n?
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
                  Cerrar sesi�n
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
              Recibe alertas sobre tus pedidos y promociones especiales. Si el
              permiso est� bloqueado, debes activarlo en la configuraci�n del
              sistema.
            </ThemedText>
            <View
              style={[
                styles.strikeInfoCard,
                {
                  backgroundColor: theme.backgroundSecondary,
                  marginBottom: Spacing.md,
                },
              ]}
            >
              <Feather name="info" size={16} color={theme.textSecondary} />
              <ThemedText
                type="caption"
                style={{
                  color: theme.textSecondary,
                  marginLeft: Spacing.sm,
                  flex: 1,
                }}
              >
                Estado del permiso:{" "}
                {notificationStatus === "granted"
                  ? "Permitido"
                  : notificationStatus === "denied"
                    ? "Bloqueado"
                    : "Sin solicitar"}
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
                  settings.notificationsEnabled
                    ? ComeYaColors.primary
                    : "#f4f3f4"
                }
              />
            </View>
            {notificationStatus === "denied" ? (
              <Pressable
                style={[
                  styles.modalButtonFull,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    borderWidth: 1,
                    borderColor: theme.border,
                    marginTop: Spacing.sm,
                  },
                ]}
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
                  Espa�ol
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
              M�s idiomas pr�ximamente...
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
            <ThemedText type="h3">T�rminos y condiciones</ThemedText>
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
              Bienvenido a ComeYa. Al utilizar nuestra aplicacion, aceptas estos
              terminos y condiciones. Por favor, leelos cuidadosamente.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              1. Aceptacion de Terminos
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Al descargar, instalar o usar la aplicacion ComeYa, confirmas que
              has leido, entendido y aceptas estar sujeto a estos Terminos y
              Condiciones. Si no estas de acuerdo, no uses la aplicacion.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              2. Descripcion del Servicio
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              ComeYa es una plataforma de delivery local que conecta a clientes
              con negocios locales y repartidores en Soria, Espana. Facilitamos
              la compra y entrega de alimentos, productos de mercado y otros
              articulos de negocios participantes.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              3. Registro y Cuenta
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Para usar ComeYa debes registrarte con un numero de telefono
              valido espanol (+34). Eres responsable de mantener la
              confidencialidad de tu cuenta y de todas las actividades que
              ocurran bajo ella. Debes proporcionar informacion veraz y
              actualizada.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              4. Pedidos y Pagos
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Los precios mostrados incluyen IVA. Los cargos de envio se
              calculan segun la distancia y se muestran antes de confirmar tu
              pedido. Aceptamos pagos con tarjeta de credito/debito, Bizum y
              efectivo. Los pedidos pueden cancelarse sin penalizacion dentro de
              los primeros 60 segundos.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              5. Entregas
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Los tiempos de entrega son estimados y pueden variar segun la
              demanda, condiciones climaticas y trafico en Soria. ComeYa no se
              hace responsable por retrasos fuera de nuestro control. Debes
              estar disponible para recibir tu pedido en la direccion indicada.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              6. Cancelaciones y Reembolsos
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Puedes cancelar tu pedido sin cargo dentro de los primeros 60
              segundos. Despues de este periodo, pueden aplicar cargos segun el
              estado del pedido. Los reembolsos se procesan en 5-10 dias habiles
              al metodo de pago original.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              7. Conducta del Usuario
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Te comprometes a usar ComeYa de manera responsable y respetuosa.
              Esta prohibido el uso fraudulento, el acoso a repartidores o
              negocios, y cualquier actividad ilegal. ComeYa se reserva el
              derecho de suspender cuentas que violen estas normas.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              8. Limitacion de Responsabilidad
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              ComeYa actua como intermediario entre clientes, negocios y
              repartidores en Soria. No somos responsables por la calidad de los
              productos, alergenos no declarados, o problemas de salud derivados
              del consumo. Los negocios son responsables de la preparacion y
              calidad de sus productos.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              9. Modificaciones
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              ComeYa puede modificar estos terminos en cualquier momento. Te
              notificaremos de cambios significativos. El uso continuado de la
              aplicacion constituye aceptacion de los nuevos terminos.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              10. Contacto
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Para dudas o comentarios sobre estos terminos, contactanos a
              traves de la seccion de Ayuda y Soporte en la aplicacion o al
              correo soporte@comeya.es
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
              En ComeYa, tu privacidad es nuestra prioridad. Esta politica
              describe como recopilamos, usamos y protegemos tu informacion
              personal conforme al Reglamento General de Proteccion de Datos
              (RGPD).
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              1. Datos que Recopilamos
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Recopilamos: nombre completo, numero de telefono espanol (+34),
              direcciones de entrega en Soria, historial de pedidos, datos de
              pago (procesados de forma segura por Stripe), ubicacion GPS (solo
              repartidores durante entregas activas), y preferencias de usuario.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              2. Uso de la Informacion
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Usamos tu informacion para: procesar y entregar tus pedidos en
              Soria, verificar tu identidad, procesar pagos, enviarte
              notificaciones sobre tus pedidos, mejorar nuestros servicios, y
              cumplir con obligaciones legales en Espana.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              3. Terceros con Acceso a tus Datos
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Compartimos datos minimos con: negocios locales de Soria (nombre y
              direccion para preparar pedidos), repartidores (nombre y direccion
              de entrega), Stripe (pagos), Twilio (SMS de verificacion), Google
              Maps (rutas), y Cloudinary (imagenes). No vendemos tus datos a
              terceros.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              4. Seguridad de Datos
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Implementamos: contrasenas cifradas con bcrypt, comunicaciones
              HTTPS/TLS, tokens JWT con expiracion automatica, rate limiting
              anti-fuerza bruta, y auditoria de accesos. En caso de brecha, te
              notificaremos en 72 horas segun el RGPD.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              5. Tus Derechos (RGPD)
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Como usuario en la Union Europea tienes derecho a: acceder a tus
              datos, rectificar informacion incorrecta, solicitar la eliminacion
              ("derecho al olvido"), portabilidad de datos (JSON/CSV), oponerte
              al tratamiento, y presentar reclamacion ante la AEPD (aepd.es).
              Respondemos en maximo 30 dias.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              6. Retencion de Datos
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Datos de cuenta activa: mientras mantengas tu cuenta. Historial de
              pedidos: 5 anos (obligacion fiscal). Ubicacion GPS: maximo 30 dias
              tras la entrega. Cuenta eliminada: datos anonimizados en 30 dias,
              salvo los requeridos por ley espanola.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              7. Permisos de la App Android
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              La app solicita: Ubicacion (para repartidores y mostrar negocios
              cercanos), Camara (escanear QR y fotos de perfil), Almacenamiento
              (seleccionar imagenes), Notificaciones (alertas de pedidos).
              Puedes revocar permisos en Ajustes del dispositivo.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              8. Menores de Edad
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              ComeYa no esta dirigido a menores de 16 anos. No recopilamos
              intencionalmente informacion de menores. Si eres padre/madre y
              crees que tu hijo ha proporcionado datos, contactanos para
              eliminarlos inmediatamente.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              9. Cambios a esta Politica
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Podemos actualizar esta politica periodicamente. Te notificaremos
              de cambios significativos a traves de la aplicacion o por SMS. El
              uso continuado implica aceptacion de la politica actualizada.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              10. Contacto � Privacidad
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Para ejercer tus derechos o resolver dudas sobre privacidad,
              contactanos a traves de Ayuda y Soporte en la app o al correo:
              privacidad@comeya.es
            </ThemedText>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showEditProfileModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditProfileModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setShowEditProfileModal(false)}
          />
          <View style={[styles.editModalCard, { backgroundColor: theme.card }]}>
            {/* Header */}
            <View
              style={[
                styles.editModalHeader,
                { borderBottomColor: theme.border },
              ]}
            >
              <ThemedText type="h3">Editar perfil</ThemedText>
              <Pressable
                onPress={() => setShowEditProfileModal(false)}
                style={styles.editModalClose}
              >
                <Feather name="x" size={22} color={theme.text} />
              </Pressable>
            </View>
            {/* Tabs */}
            <View
              style={[
                styles.editModalTabs,
                { borderBottomColor: theme.border },
              ]}
            >
              {(["datos", "seguridad", "profesion"] as const).map((tab) => (
                <Pressable
                  key={tab}
                  onPress={() => setEditTab(tab)}
                  style={[
                    styles.editModalTab,
                    editTab === tab && {
                      borderBottomColor: ComeYaColors.primary,
                      borderBottomWidth: 2,
                    },
                  ]}
                >
                  <ThemedText
                    type="body"
                    style={{
                      fontWeight: "600",
                      color:
                        editTab === tab
                          ? ComeYaColors.primary
                          : theme.textSecondary,
                    }}
                  >
                    {tab === "datos"
                      ? "Datos"
                      : tab === "seguridad"
                        ? "Seguridad"
                        : "Profesi�n"}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.editModalBody}
              keyboardShouldPersistTaps="handled"
            >
              {editTab === "datos" ? (
                <>
                  <ThemedText
                    type="caption"
                    style={{ color: theme.textSecondary, marginBottom: 4 }}
                  >
                    Nombre
                  </ThemedText>
                  <TextInput
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Tu nombre"
                    placeholderTextColor={theme.textSecondary}
                    style={[
                      styles.editInput,
                      {
                        backgroundColor: theme.backgroundSecondary,
                        color: theme.text,
                        borderColor: theme.border,
                      },
                    ]}
                  />
                  <ThemedText
                    type="caption"
                    style={{
                      color: theme.textSecondary,
                      marginBottom: 4,
                      marginTop: 12,
                    }}
                  >
                    Email
                  </ThemedText>
                  <TextInput
                    value={editEmail}
                    onChangeText={setEditEmail}
                    placeholder="tu@email.com"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={[
                      styles.editInput,
                      {
                        backgroundColor: theme.backgroundSecondary,
                        color: theme.text,
                        borderColor: theme.border,
                      },
                    ]}
                  />
                  <ThemedText
                    type="caption"
                    style={{
                      color: theme.textSecondary,
                      marginBottom: 4,
                      marginTop: 12,
                    }}
                  >
                    DNI / C�dula
                  </ThemedText>
                  <TextInput
                    value={editDni}
                    onChangeText={setEditDni}
                    placeholder="N�mero de documento"
                    placeholderTextColor={theme.textSecondary}
                    style={[
                      styles.editInput,
                      {
                        backgroundColor: theme.backgroundSecondary,
                        color: theme.text,
                        borderColor: theme.border,
                      },
                    ]}
                  />
                  <Pressable
                    onPress={saveProfile}
                    disabled={isSavingProfile}
                    style={[
                      styles.editSaveBtn,
                      {
                        backgroundColor: ComeYaColors.primary,
                        opacity: isSavingProfile ? 0.7 : 1,
                      },
                    ]}
                  >
                    {isSavingProfile ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <ThemedText
                        type="body"
                        style={{ color: "#fff", fontWeight: "700" }}
                      >
                        Guardar cambios
                      </ThemedText>
                    )}
                  </Pressable>
                </>
              ) : editTab === "seguridad" ? (
                <>
                  <ThemedText
                    type="caption"
                    style={{ color: theme.textSecondary, marginBottom: 4 }}
                  >
                    Contrase�a actual
                  </ThemedText>
                  <TextInput
                    value={editCurrentPassword}
                    onChangeText={setEditCurrentPassword}
                    placeholder="��������"
                    placeholderTextColor={theme.textSecondary}
                    secureTextEntry
                    style={[
                      styles.editInput,
                      {
                        backgroundColor: theme.backgroundSecondary,
                        color: theme.text,
                        borderColor: theme.border,
                      },
                    ]}
                  />
                  <ThemedText
                    type="caption"
                    style={{
                      color: theme.textSecondary,
                      marginBottom: 4,
                      marginTop: 12,
                    }}
                  >
                    Nueva contrase�a
                  </ThemedText>
                  <TextInput
                    value={editNewPassword}
                    onChangeText={setEditNewPassword}
                    placeholder="M�nimo 6 caracteres"
                    placeholderTextColor={theme.textSecondary}
                    secureTextEntry
                    style={[
                      styles.editInput,
                      {
                        backgroundColor: theme.backgroundSecondary,
                        color: theme.text,
                        borderColor: theme.border,
                      },
                    ]}
                  />
                  <Pressable
                    onPress={changePassword}
                    disabled={isSavingProfile}
                    style={[
                      styles.editSaveBtn,
                      {
                        backgroundColor: ComeYaColors.primary,
                        opacity: isSavingProfile ? 0.7 : 1,
                      },
                    ]}
                  >
                    {isSavingProfile ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <ThemedText
                        type="body"
                        style={{ color: "#fff", fontWeight: "700" }}
                      >
                        Cambiar contrase�a
                      </ThemedText>
                    )}
                  </Pressable>
                </>
              ) : (
                // Profesi�n tab - solo documentos personales para drivers/business owners
                // Los datos del veh�culo est�n en "Mi veh�culo"
                <>
                  <ThemedText
                    type="body"
                    style={{
                      color: theme.textSecondary,
                      marginBottom: Spacing.md,
                    }}
                  >
                    {user?.role === "delivery_driver"
                      ? "Para gestionar tu veh�culo y sus documentos, ve a 'Mi veh�culo' en la pantalla de perfil."
                      : "Gestiona tus documentos de verificaci�n abajo."}
                  </ThemedText>

                  {user?.role === "business_owner" && (
                    <>
                      <ThemedText
                        type="h4"
                        style={{ marginBottom: Spacing.md }}
                      >
                        Documentos
                      </ThemedText>
                      <View
                        style={[
                          styles.strikeInfoCard,
                          {
                            backgroundColor: theme.backgroundSecondary,
                            marginBottom: Spacing.md,
                          },
                        ]}
                      >
                        <Feather
                          name="info"
                          size={16}
                          color={theme.textSecondary}
                        />
                        <ThemedText
                          type="caption"
                          style={{
                            color: theme.textSecondary,
                            marginLeft: Spacing.sm,
                            flex: 1,
                          }}
                        >
                          Aqu� puedes ver el estado de tus documentos. Contacta
                          soporte si necesitas actualizar algo.
                        </ThemedText>
                      </View>
                    </>
                  )}

                  {/* Document upload section - Drivers - SOLO documentos personales */}
                  {user?.role === "delivery_driver" && (
                    <>
                      <ThemedText
                        type="h4"
                        style={{
                          marginTop: Spacing.lg,
                          marginBottom: Spacing.md,
                        }}
                      >
                        Documentos personales
                      </ThemedText>

                      <DocumentUploadButton
                        documentType="idDocument"
                        label="DNI / Identificaci�n (frente)"
                        currentUrl={professionalData?.idDocumentUrl}
                      />
                      <DocumentUploadButton
                        documentType="idDocumentBack"
                        label="DNI / Identificaci�n (reverso)"
                        currentUrl={professionalData?.idDocumentBackUrl}
                      />
                      <DocumentUploadButton
                        documentType="autonomo"
                        label="Documento de Aut�nomo"
                        currentUrl={professionalData?.autonomoDocumentUrl}
                      />
                      <View
                        style={[
                          styles.strikeInfoCard,
                          {
                            backgroundColor: theme.backgroundSecondary,
                            marginTop: Spacing.md,
                          },
                        ]}
                      >
                        <Feather
                          name="truck"
                          size={16}
                          color={theme.textSecondary}
                        />
                        <ThemedText
                          type="caption"
                          style={{
                            color: theme.textSecondary,
                            marginLeft: Spacing.sm,
                            flex: 1,
                          }}
                        >
                          Los documentos del veh�culo est�n en "Mi veh�culo"
                        </ThemedText>
                      </View>
                    </>
                  )}

                  {/* Document upload section - Business owners */}
                  {user?.role === "business_owner" && (
                    <>
                      <ThemedText
                        type="h4"
                        style={{
                          marginTop: Spacing.lg,
                          marginBottom: Spacing.md,
                        }}
                      >
                        Documentos
                      </ThemedText>

                      <DocumentUploadButton
                        documentType="idDocument"
                        label="DNI / Identificaci�n"
                        currentUrl={professionalData?.idDocumentUrl}
                      />
                      <DocumentUploadButton
                        documentType="autonomo"
                        label="Documento de Aut�nomo"
                        currentUrl={professionalData?.autonomoDocumentUrl}
                      />
                    </>
                  )}

                  {/* Show save button only for drivers (they can edit vehicle) */}
                  {user?.role === "delivery_driver" && (
                    <Pressable
                      onPress={saveVehicle}
                      disabled={isSavingVehicle}
                      style={[
                        styles.editSaveBtn,
                        {
                          backgroundColor: ComeYaColors.primary,
                          opacity: isSavingVehicle ? 0.7 : 1,
                        },
                      ]}
                    >
                      {isSavingVehicle ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <ThemedText
                          type="body"
                          style={{ color: "#fff", fontWeight: "700" }}
                        >
                          Guardar veh�culo
                        </ThemedText>
                      )}
                    </Pressable>
                  )}

                  {/* Info for business owners */}
                  {user?.role === "business_owner" && (
                    <Pressable
                      onPress={() => {
                        setShowEditProfileModal(false);
                        navigation.navigate("Support" as any);
                      }}
                      style={[
                        styles.editSaveBtn,
                        {
                          backgroundColor: theme.backgroundSecondary,
                          marginTop: Spacing.lg,
                        },
                      ]}
                    >
                      <ThemedText type="body" style={{ color: theme.text }}>
                        Contactar soporte
                      </ThemedText>
                    </Pressable>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
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
              Esta funci�n estar� disponible pr�ximamente. Podr�s gestionar tus
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

      {/* Vehicle Modal */}
      <Modal
        visible={showVehicleModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowVehicleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setShowVehicleModal(false)}
          />
          <View style={[styles.editModalCard, { backgroundColor: theme.card }]}>
            <View
              style={[
                styles.editModalHeader,
                { borderBottomColor: theme.border },
              ]}
            >
              <ThemedText type="h3">Mi veh�culo</ThemedText>
              <Pressable
                onPress={() => setShowVehicleModal(false)}
                style={styles.editModalClose}
              >
                <Feather name="x" size={22} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.editModalBody}
              keyboardShouldPersistTaps="handled"
            >
              <ThemedText
                type="caption"
                style={{ color: theme.textSecondary, marginBottom: 4 }}
              >
                Tipo de veh�culo *
              </ThemedText>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                {["car", "motorcycle", "bicycle"].map((type) => (
                  <Pressable
                    key={type}
                    onPress={() =>
                      setVehicleForm((f) => ({ ...f, vehicleType: type }))
                    }
                    style={{
                      flex: 1,
                      padding: 12,
                      borderRadius: 12,
                      backgroundColor:
                        vehicleForm.vehicleType === type
                          ? ComeYaColors.primaryLight
                          : theme.backgroundSecondary,
                      borderWidth: 2,
                      borderColor:
                        vehicleForm.vehicleType === type
                          ? ComeYaColors.primary
                          : "transparent",
                      alignItems: "center",
                    }}
                  >
                    <Feather
                      name={
                        type === "car"
                          ? "truck"
                          : type === "motorcycle"
                            ? "zap"
                            : "wind"
                      }
                      size={24}
                      color={
                        vehicleForm.vehicleType === type
                          ? ComeYaColors.primary
                          : theme.textSecondary
                      }
                    />
                    <ThemedText
                      type="caption"
                      style={{
                        color:
                          vehicleForm.vehicleType === type
                            ? ComeYaColors.primary
                            : theme.text,
                        marginTop: 4,
                      }}
                    >
                      {type === "car"
                        ? "Coche"
                        : type === "motorcycle"
                          ? "Moto"
                          : "Bici"}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              <ThemedText
                type="caption"
                style={{ color: theme.textSecondary, marginBottom: 4 }}
              >
                Marca
              </ThemedText>
              <TextInput
                value={vehicleForm.vehicleBrand}
                onChangeText={(text) =>
                  setVehicleForm((f) => ({ ...f, vehicleBrand: text }))
                }
                placeholder="Ej: Toyota, Yamaha, Bianchi"
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.editInput,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
              />

              <ThemedText
                type="caption"
                style={{
                  color: theme.textSecondary,
                  marginBottom: 4,
                  marginTop: 12,
                }}
              >
                Modelo
              </ThemedText>
              <TextInput
                value={vehicleForm.vehicleModel}
                onChangeText={(text) =>
                  setVehicleForm((f) => ({ ...f, vehicleModel: text }))
                }
                placeholder="Ej: Corolla, MT-07, Tornado"
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.editInput,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
              />

              <ThemedText
                type="caption"
                style={{
                  color: theme.textSecondary,
                  marginBottom: 4,
                  marginTop: 12,
                }}
              >
                Matr�cula
              </ThemedText>
              <TextInput
                value={vehicleForm.vehiclePlate}
                onChangeText={(text) =>
                  setVehicleForm((f) => ({ ...f, vehiclePlate: text }))
                }
                placeholder="Ej: 1234ABC"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="characters"
                style={[
                  styles.editInput,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
              />

              <ThemedText
                type="caption"
                style={{
                  color: theme.textSecondary,
                  marginBottom: 4,
                  marginTop: 12,
                }}
              >
                Color
              </ThemedText>
              <TextInput
                value={vehicleForm.vehicleColor}
                onChangeText={(text) =>
                  setVehicleForm((f) => ({ ...f, vehicleColor: text }))
                }
                placeholder="Ej: Blanco, Negro, Rojo"
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.editInput,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
              />

              {/* Documentos del veh�culo - solo para moto/coche */}
              {(vehicleForm.vehicleType === "motorcycle" ||
                vehicleForm.vehicleType === "car") && (
                <>
                  <ThemedText
                    type="h4"
                    style={{ marginTop: Spacing.lg, marginBottom: Spacing.md }}
                  >
                    Documentos del veh�culo
                  </ThemedText>

                  <DocumentUploadButton
                    documentType="vehiclePhoto"
                    label="Foto del veh�culo"
                    currentUrl={professionalData?.vehiclePhoto}
                  />
                  <DocumentUploadButton
                    documentType="vehiclePlate"
                    label="Foto matr�cula"
                    currentUrl={professionalData?.vehiclePlatePhoto}
                  />
                  <DocumentUploadButton
                    documentType="vehicleItv"
                    label="ITV"
                    currentUrl={professionalData?.vehicleItvPhoto}
                  />
                  <DocumentUploadButton
                    documentType="vehicleInsurance"
                    label="Seguro del veh�culo"
                    currentUrl={professionalData?.vehicleInsurancePhoto}
                  />
                  <DocumentUploadButton
                    documentType="vehicleLicense"
                    label="Licencia de conducir"
                    currentUrl={professionalData?.vehicleLicensePhoto}
                  />
                </>
              )}

              <Pressable
                onPress={saveVehicle}
                disabled={isSavingVehicle}
                style={[
                  styles.editSaveBtn,
                  {
                    backgroundColor: ComeYaColors.primary,
                    opacity: isSavingVehicle ? 0.7 : 1,
                  },
                ]}
              >
                {isSavingVehicle ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <ThemedText
                    type="body"
                    style={{ color: "#fff", fontWeight: "700" }}
                  >
                    Guardar veh�culo
                  </ThemedText>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Document Image Preview Modal */}
      <Modal
        visible={showPreviewModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPreviewModal(false)}
      >
        <Pressable
          style={styles.previewModalOverlay}
          onPress={() => setShowPreviewModal(false)}
        >
          <Pressable
            style={styles.previewModalContent}
            onPress={(e) => e.stopPropagation()}
          >
            <View
              style={[
                styles.previewModalHeader,
                { borderBottomColor: theme.border },
              ]}
            >
              <ThemedText type="h4">Vista previa</ThemedText>
              <Pressable
                onPress={() => setShowPreviewModal(false)}
                style={[
                  styles.previewModalClose,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>
            {previewImage && (
              <Image
                source={{ uri: previewImage }}
                style={styles.previewImage}
                contentFit="contain"
              />
            )}
          </Pressable>
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
  // Preview modal styles
  previewModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  previewModalContent: {
    width: "100%",
    maxWidth: "95%",
    maxHeight: "80%",
    backgroundColor: "#fff",
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  previewModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  previewModalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  previewImage: {
    width: "100%",
    height: 400,
  },
});
