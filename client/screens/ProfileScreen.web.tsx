import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Text,
  ActivityIndicator,
  Platform,
  Modal,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { ThemedText } from "@/components/ThemedText";
import { Badge } from "@/components/Badge";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useApp, ThemeMode } from "@/contexts/AppContext";
import { useToast } from "@/contexts/ToastContext";
import { ComeYaColors } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { useResponsive } from "@/hooks/useResponsive";
import { MobileSidebarWrapper } from "@/components/MobileSidebarWrapper";
import { confirm } from "@/hooks/useWebDialog";

const PRIMARY = "#DC2626";

function resolveProfileImageUrl(profileImage: string): string {
  if (profileImage.startsWith("data:image/")) return profileImage;
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
  const navigation = useNavigation<any>();
  const { theme, isDark, themeMode, setThemeMode } = useTheme();
  const { settings, updateSettings } = useApp();
  const { user, logout, updateUser } = useAuth();
  const { showToast } = useToast();
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [driverStats, setDriverStats] = useState<any>(null);
  const [activeSection, setActiveSection] = useState("account");
  const [subscription, setSubscription] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState(user?.name || "");
  const [editEmail, setEditEmail] = useState(user?.email || "");
  const [editDni, setEditDni] = useState((user as any)?.dni || "");
  const [editAddress, setEditAddress] = useState((user as any)?.address || "");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const isBusiness = user?.role === "business_owner";
  const { isMobile } = useResponsive();

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const border = isDark ? "#333" : "#e8e8e8";

  useEffect(() => {
    if (user?.role === "delivery_driver") {
      Promise.all([
        apiRequest("GET", "/api/delivery/status"),
        apiRequest("GET", "/api/users/profile/full"),
      ])
        .then(([statusRes, profileRes]) =>
          Promise.all([statusRes.json(), profileRes.json()]),
        )
        .then(([statusData, profileData]) => {
          if (statusData.success && profileData.success) {
            setDriverStats({
              rating: statusData.rating || 0,
              totalDeliveries: statusData.totalDeliveries || 0,
              strikes: statusData.strikes || 0,
              vehicleType: profileData.vehicleType,
              vehiclePlate: profileData.vehiclePlate,
              verificationStatus: user?.isActive ? "verified" : "pending",
            });
          }
        })
        .catch(console.error);
    }
  }, [user?.role]);

  useEffect(() => {
    if (user) {
      apiRequest("GET", "/api/user/profile")
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.user?.profileImage) {
            const img = data.user.profileImage;
            if (img.startsWith("data:image/")) {
              setProfileImage(img);
            } else {
              const version = Date.now();
              setProfileImage(`${resolveProfileImageUrl(img)}?v=${version}`);
            }
            updateUser({ profileImage: img });
          }
        })
        .catch(console.error);

      // Cargar suscripción
      if (user.role === "customer") {
        apiRequest("GET", "/api/subscriptions/my-subscription")
          .then((r) => r.json())
          .then((data) => {
            if (data.success) setSubscription(data.subscription);
          })
          .catch(() => {});
      }
    }
  }, []);

  const pickImage = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      await uploadImage(URL.createObjectURL(file));
    };
    input.click();
  };

  const uploadImage = async (uri: string) => {
    setIsUploadingImage(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const reader = new FileReader();
      const imageData: string = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const estimatedBytes = Math.ceil(imageData.length * 0.75);
      if (estimatedBytes > 2 * 1024 * 1024) {
        throw new Error(
          "La imagen es muy pesada. Usa una foto más ligera (~2MB max)",
        );
      }

      const apiResponse = await apiRequest("POST", "/api/user/profile-image", {
        image: imageData,
      });
      const data = await apiResponse.json();

      if (data.success && data.profileImage) {
        const img = data.profileImage;
        const fullUrl = img.startsWith("data:image/")
          ? img
          : `${resolveProfileImageUrl(img)}?v=${Date.now()}`;
        setProfileImage(null);
        setTimeout(() => setProfileImage(fullUrl), 100);
        await updateUser({ profileImage: img });
        showToast("Imagen actualizada", "success");
      } else {
        throw new Error(data.error || "Error al subir imagen");
      }
    } catch (error: any) {
      showToast(error?.message || "No se pudo subir la imagen", "error");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleLogout = async () => {
    const ok = await confirm({
      title: "Cerrar sesión",
      message: "¿Estás seguro que deseas salir?",
      confirmLabel: "Salir",
      cancelLabel: "Cancelar",
      variant: "warning",
    });
    if (ok) logout();
  };

  const handleDeleteAccount = () => {
    navigation.navigate("DeleteAccount");
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

  const approvalStatus =
    user?.role === "business_owner" || user?.role === "delivery_driver"
      ? user?.isActive
        ? { text: "Aprobado", variant: "success" as const }
        : { text: "En revisión", variant: "warning" as const }
      : null;

  const subBadge =
    subscription?.status === "active" && subscription?.plan !== "free"
      ? subscription.plan === "business"
        ? { label: "💼 Business", bg: "#7C3AED20", color: "#7C3AED" }
        : { label: "⭐ Premium", bg: "#F59E0B20", color: "#D97706" }
      : null;

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <EditProfileModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
      />
      {isBusiness ? (
        <MobileSidebarWrapper
          title="Mi Perfil"
          sidebarStyle={[
            s.sidebar,
            { backgroundColor: card, borderRightColor: border },
          ]}
        >
          <View style={[s.sideHeader, { borderBottomColor: border }]}>
            <Pressable
              style={s.avatarContainer}
              onPress={pickImage}
              disabled={isUploadingImage}
            >
              <Image
                source={
                  profileImage
                    ? { uri: profileImage }
                    : require("../../assets/images/avatar-placeholder.png")
                }
                style={[s.avatar, isUploadingImage && { opacity: 0.5 }]}
                onError={() => setProfileImage(null)}
                contentFit="cover"
              />
              {isUploadingImage ? (
                <View style={[s.editBadge, { backgroundColor: PRIMARY }]}>
                  <ActivityIndicator size="small" color="#FFF" />
                </View>
              ) : (
                <View style={[s.editBadge, { backgroundColor: PRIMARY }]}>
                  <Feather name="camera" size={12} color="#FFF" />
                </View>
              )}
            </Pressable>
            <Text style={[s.userName, { color: text }]}>
              {user?.name || "Usuario"}
            </Text>
            <Text style={[s.userPhone, { color: sub }]}>
              {user?.phone || "Sin teléfono"}
            </Text>
            <View style={s.badges}>
              <View style={[s.roleBadge, { backgroundColor: PRIMARY + "15" }]}>
                <Text style={[s.roleBadgeText, { color: PRIMARY }]}>
                  {getRoleLabel()}
                </Text>
              </View>
              {subBadge && (
                <View style={[s.roleBadge, { backgroundColor: subBadge.bg }]}>
                  <Text style={[s.roleBadgeText, { color: subBadge.color }]}>
                    {subBadge.label}
                  </Text>
                </View>
              )}
              {approvalStatus && (
                <View
                  style={[
                    s.roleBadge,
                    {
                      backgroundColor:
                        approvalStatus.variant === "success"
                          ? "#4CAF5020"
                          : "#F59E0B20",
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.roleBadgeText,
                      {
                        color:
                          approvalStatus.variant === "success"
                            ? "#4CAF50"
                            : "#F59E0B",
                      },
                    ]}
                  >
                    {approvalStatus.text}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <View style={s.sideNav}>
            {[
              { id: "account", label: "Cuenta", icon: "user" },
              { id: "payments", label: "Pagos", icon: "credit-card" },
              { id: "preferences", label: "Preferencias", icon: "settings" },
              { id: "more", label: "Más", icon: "grid" },
            ].map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setActiveSection(item.id)}
                style={[
                  s.navItem,
                  activeSection === item.id && s.navItemActive,
                ]}
              >
                <Feather
                  name={item.icon as any}
                  size={18}
                  color={activeSection === item.id ? PRIMARY : sub}
                />
                <Text
                  style={[
                    s.navItemText,
                    { color: activeSection === item.id ? PRIMARY : text },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={[s.sideFooter, { borderTopColor: border }]}>
            <Pressable onPress={handleDeleteAccount} style={s.logoutBtn}>
              <Feather name="trash-2" size={18} color="#EF4444" />
              <Text style={[s.logoutBtnText, { color: "#EF4444" }]}>
                Eliminar cuenta
              </Text>
            </Pressable>
            <Pressable onPress={handleLogout} style={s.logoutBtn}>
              <Feather name="log-out" size={18} color="#EF4444" />
              <Text style={[s.logoutBtnText, { color: "#EF4444" }]}>
                Cerrar sesión
              </Text>
            </Pressable>
          </View>
        </MobileSidebarWrapper>
      ) : (
        <MobileSidebarWrapper
          title="Mi Perfil"
          sidebarStyle={[
            s.sidebar,
            { backgroundColor: card, borderRightColor: border },
          ]}
        >
          {/* Profile Header */}
          <View style={[s.sideHeader, { borderBottomColor: border }]}>
            <Pressable
              style={s.avatarContainer}
              onPress={pickImage}
              disabled={isUploadingImage}
            >
              <Image
                source={
                  profileImage
                    ? { uri: profileImage }
                    : require("../../assets/images/avatar-placeholder.png")
                }
                style={[s.avatar, isUploadingImage && { opacity: 0.5 }]}
                onError={() => setProfileImage(null)}
                contentFit="cover"
              />
              {isUploadingImage ? (
                <View style={[s.editBadge, { backgroundColor: PRIMARY }]}>
                  <ActivityIndicator size="small" color="#FFF" />
                </View>
              ) : (
                <View style={[s.editBadge, { backgroundColor: PRIMARY }]}>
                  <Feather name="camera" size={12} color="#FFF" />
                </View>
              )}
            </Pressable>
            <Text style={[s.userName, { color: text }]}>
              {user?.name || "Usuario"}
            </Text>
            <Text style={[s.userPhone, { color: sub }]}>
              {user?.phone || "Sin teléfono"}
            </Text>
            <View style={s.badges}>
              <View style={[s.roleBadge, { backgroundColor: PRIMARY + "15" }]}>
                <Text style={[s.roleBadgeText, { color: PRIMARY }]}>
                  {getRoleLabel()}
                </Text>
              </View>
              {subBadge && (
                <View style={[s.roleBadge, { backgroundColor: subBadge.bg }]}>
                  <Text style={[s.roleBadgeText, { color: subBadge.color }]}>
                    {subBadge.label}
                  </Text>
                </View>
              )}
              {approvalStatus && (
                <View
                  style={[
                    s.roleBadge,
                    {
                      backgroundColor:
                        approvalStatus.variant === "success"
                          ? "#4CAF5020"
                          : "#F59E0B20",
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.roleBadgeText,
                      {
                        color:
                          approvalStatus.variant === "success"
                            ? "#4CAF50"
                            : "#F59E0B",
                      },
                    ]}
                  >
                    {approvalStatus.text}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <View style={s.sideNav}>
            {[
              { id: "account", label: "Cuenta", icon: "user" },
              { id: "preferences", label: "Preferencias", icon: "settings" },
              { id: "more", label: "Más", icon: "grid" },
            ].map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setActiveSection(item.id)}
                style={[
                  s.navItem,
                  activeSection === item.id && s.navItemActive,
                ]}
              >
                <Feather
                  name={item.icon as any}
                  size={18}
                  color={activeSection === item.id ? PRIMARY : sub}
                />
                <Text
                  style={[
                    s.navItemText,
                    { color: activeSection === item.id ? PRIMARY : text },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={[s.sideFooter, { borderTopColor: border }]}>
            <Pressable onPress={handleDeleteAccount} style={s.logoutBtn}>
              <Feather name="trash-2" size={18} color="#EF4444" />
              <Text style={[s.logoutBtnText, { color: "#EF4444" }]}>
                Eliminar cuenta
              </Text>
            </Pressable>
            <Pressable onPress={handleLogout} style={s.logoutBtn}>
              <Feather name="log-out" size={18} color="#EF4444" />
              <Text style={[s.logoutBtnText, { color: "#EF4444" }]}>
                Cerrar sesión
              </Text>
            </Pressable>
          </View>
        </MobileSidebarWrapper>
      )}

      {/* CONTENT */}
      <ScrollView
        style={s.main}
        contentContainerStyle={s.mainContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Nav horizontal móvil */}
        {isMobile && (
          <View
            style={[
              s.mobileNav,
              { backgroundColor: card, borderBottomColor: border },
            ]}
          >
            {/* Avatar compacto */}
            <View style={[s.mobileHeader, { borderBottomColor: border }]}>
              <Pressable
                style={s.avatarContainer}
                onPress={pickImage}
                disabled={isUploadingImage}
              >
                <Image
                  source={
                    profileImage
                      ? { uri: profileImage }
                      : require("../../assets/images/avatar-placeholder.png")
                  }
                  style={s.avatarSmall}
                  onError={() => setProfileImage(null)}
                  contentFit="cover"
                />
                <View style={[s.editBadge, { backgroundColor: PRIMARY }]}>
                  {isUploadingImage ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Feather name="camera" size={10} color="#FFF" />
                  )}
                </View>
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    s.userName,
                    { color: text, fontSize: 15, marginBottom: 0 },
                  ]}
                >
                  {user?.name || "Usuario"}
                </Text>
                <Text style={[s.userPhone, { color: sub, marginBottom: 0 }]}>
                  {user?.phone || ""}
                </Text>
              </View>
              <Pressable onPress={handleLogout}>
                <Feather name="log-out" size={20} color="#EF4444" />
              </Pressable>
            </View>
            {/* Tabs */}
            <View style={s.mobileTabs}>
              {[
                { id: "account", label: "Cuenta", icon: "user" },
                { id: "preferences", label: "Ajustes", icon: "settings" },
                { id: "more", label: "Más", icon: "grid" },
              ].map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => setActiveSection(item.id)}
                  style={[
                    s.mobileTab,
                    activeSection === item.id && {
                      borderBottomColor: PRIMARY,
                      borderBottomWidth: 2,
                    },
                  ]}
                >
                  <Feather
                    name={item.icon as any}
                    size={16}
                    color={activeSection === item.id ? PRIMARY : sub}
                  />
                  <Text
                    style={[
                      s.mobileTabText,
                      { color: activeSection === item.id ? PRIMARY : sub },
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
        {/* Avatar header para business (el sidebar no lo muestra) */}
        {isBusiness && (
          <View
            style={[
              s.businessHeader,
              { backgroundColor: card, borderColor: border },
            ]}
          >
            <Pressable
              style={s.avatarContainer}
              onPress={pickImage}
              disabled={isUploadingImage}
            >
              <Image
                source={
                  profileImage
                    ? { uri: profileImage }
                    : require("../../assets/images/avatar-placeholder.png")
                }
                style={[s.avatar, isUploadingImage && { opacity: 0.5 }]}
                onError={() => setProfileImage(null)}
                contentFit="cover"
              />
              {isUploadingImage ? (
                <View style={[s.editBadge, { backgroundColor: PRIMARY }]}>
                  <ActivityIndicator size="small" color="#FFF" />
                </View>
              ) : (
                <View style={[s.editBadge, { backgroundColor: PRIMARY }]}>
                  <Feather name="camera" size={12} color="#FFF" />
                </View>
              )}
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  s.userName,
                  { color: text, textAlign: "left", marginBottom: 2 },
                ]}
              >
                {user?.name || "Usuario"}
              </Text>
              <Text style={[s.userPhone, { color: sub, textAlign: "left" }]}>
                {user?.phone || "Sin teléfono"}
              </Text>
            </View>
            <View style={[s.roleBadge, { backgroundColor: PRIMARY + "15" }]}>
              <Text style={[s.roleBadgeText, { color: PRIMARY }]}>
                {getRoleLabel()}
              </Text>
            </View>
            {approvalStatus && (
              <View
                style={[
                  s.roleBadge,
                  {
                    backgroundColor:
                      approvalStatus.variant === "success"
                        ? "#4CAF5020"
                        : "#F59E0B20",
                  },
                ]}
              >
                <Text
                  style={[
                    s.roleBadgeText,
                    {
                      color:
                        approvalStatus.variant === "success"
                          ? "#4CAF50"
                          : "#F59E0B",
                    },
                  ]}
                >
                  {approvalStatus.text}
                </Text>
              </View>
            )}
          </View>
        )}
        {activeSection === "account" && isAdmin && (
          <AdminProfileSection
            user={user}
            navigation={navigation}
            theme={{ bg, card, text, sub, border }}
            onEditProfile={() => setShowEditModal(true)}
          />
        )}
        {activeSection === "account" && isBusiness && (
          <BusinessProfileSection
            user={user}
            navigation={navigation}
            theme={{ bg, card, text, sub, border }}
            onEditProfile={() => setShowEditModal(true)}
          />
        )}
        {activeSection === "account" && !isAdmin && !isBusiness && (
          <AccountSection
            user={user}
            navigation={navigation}
            driverStats={driverStats}
            subscription={subscription}
            theme={{ bg, card, text, sub, border }}
            onEditProfile={() => setShowEditModal(true)}
          />
        )}
        {activeSection === "payments" && isBusiness && (
          <BusinessPaymentsSection
            navigation={navigation}
            theme={{ bg, card, text, sub, border }}
          />
        )}
        {activeSection === "preferences" && (
          <PreferencesSection
            themeMode={themeMode}
            setThemeMode={setThemeMode}
            settings={settings}
            updateSettings={updateSettings}
            showToast={showToast}
            theme={{ bg, card, text, sub, border }}
          />
        )}
        {activeSection === "more" && (
          <MoreSection
            navigation={navigation}
            theme={{ bg, card, text, sub, border }}
          />
        )}
      </ScrollView>
    </View>
  );
}

// Componentes de secciones (continuará en siguiente parte)
function AccountSection({
  user,
  navigation,
  driverStats,
  subscription,
  theme,
  onEditProfile,
}: any) {
  const isActiveSub =
    subscription?.status === "active" && subscription?.plan !== "free";
  const isPremium = subscription?.plan === "premium";
  const isBusiness = subscription?.plan === "business";
  const renewDate = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const BENEFITS: Record<
    string,
    { icon: string; label: string; value: string }[]
  > = {
    premium: [
      {
        icon: "truck",
        label: "Envío gratis",
        value: "Ilimitado en todos tus pedidos",
      },
      {
        icon: "percent",
        label: "10% descuento",
        value: "En todos los pedidos",
      },
      {
        icon: "headphones",
        label: "Soporte prioritario",
        value: "Atención 24/7",
      },
      {
        icon: "tag",
        label: "Ofertas exclusivas",
        value: "Acceso anticipado a promociones",
      },
    ],
    business: [
      {
        icon: "truck",
        label: "Envío gratis",
        value: "Ilimitado en todos tus pedidos",
      },
      {
        icon: "percent",
        label: "15% descuento",
        value: "En todos los pedidos",
      },
      {
        icon: "headphones",
        label: "Soporte prioritario",
        value: "Atención 24/7",
      },
      {
        icon: "tag",
        label: "Ofertas exclusivas",
        value: "Acceso anticipado a promociones",
      },
      {
        icon: "minus-circle",
        label: "Sin mínimo de pedido",
        value: "Pide cualquier importe",
      },
      {
        icon: "file-text",
        label: "Facturación empresarial",
        value: "Facturas para tu empresa",
      },
    ],
  };

  return (
    <View>
      {/* Card suscripción activa */}
      {isActiveSub && (
        <View
          style={[
            s.settingsCard,
            {
              backgroundColor: theme.card,
              borderWidth: 2,
              borderColor: isPremium ? "#F59E0B40" : "#7C3AED40",
              marginBottom: 20,
            },
          ]}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <View
              style={[
                s.settingIcon,
                {
                  backgroundColor: isPremium ? "#F59E0B20" : "#7C3AED20",
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                },
              ]}
            >
              <Text style={{ fontSize: 20 }}>{isPremium ? "⭐" : "💼"}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text
                style={[s.cardTitle, { color: theme.text, marginBottom: 2 }]}
              >
                Plan {isPremium ? "Premium" : "Business"} activo
              </Text>
              <Text style={{ fontSize: 12, color: theme.sub }}>
                {isPremium ? "€15/mes" : "€30/mes"}
                {renewDate ? ` · Renueva el ${renewDate}` : ""}
              </Text>
            </View>
            <Pressable
              onPress={() => navigation.navigate("Subscriptions")}
              style={{
                backgroundColor: isPremium ? "#F59E0B" : "#7C3AED",
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
                Gestionar
              </Text>
            </Pressable>
          </View>
          <View style={{ gap: 10 }}>
            {(BENEFITS[subscription.plan] || []).map((b: any) => (
              <View
                key={b.label}
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <View
                  style={[
                    s.settingIcon,
                    {
                      backgroundColor: "#10B98120",
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                    },
                  ]}
                >
                  <Feather name={b.icon as any} size={15} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "600",
                      color: theme.text,
                    }}
                  >
                    {b.label}
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.sub }}>
                    {b.value}
                  </Text>
                </View>
                <Feather name="check" size={16} color="#10B981" />
              </View>
            ))}
          </View>
        </View>
      )}

      <Text style={[s.sectionTitle, { color: theme.text }]}>Cuenta</Text>
      <View style={[s.settingsCard, { backgroundColor: theme.card }]}>
        <SettingItem
          icon="user"
          label="Editar mi perfil"
          onPress={onEditProfile}
          theme={theme}
        />
        {user?.role === "customer" && (
          <>
            <SettingItem
              icon="map-pin"
              label="Direcciones guardadas"
              onPress={() => navigation.navigate("SavedAddresses")}
              theme={theme}
            />
            <SettingItem
              icon="credit-card"
              label="Métodos de pago"
              value="Bizum · Tarjeta · PayPal"
              onPress={() => navigation.navigate("PaymentWalletSetup")}
              theme={theme}
            />
            <SettingItem
              icon="gift"
              label="Mis puntos y recompensas"
              onPress={() => navigation.navigate("Gamification")}
              theme={theme}
            />
            <SettingItem
              icon="star"
              label="Suscripciones"
              value={
                isActiveSub
                  ? isPremium
                    ? "⭐ Premium activo"
                    : "💼 Business activo"
                  : "Plan gratuito"
              }
              onPress={() => navigation.navigate("Subscriptions")}
              theme={theme}
            />
            <SettingItem
              icon="tag"
              label="Mis Gift Cards"
              onPress={() => navigation.navigate("GiftCards")}
              theme={theme}
            />
            <SettingItem
              icon="users"
              label="Pedido grupal"
              onPress={() => navigation.navigate("GroupOrder")}
              theme={theme}
            />
            <SettingItem
              icon="clock"
              label="Pedidos programados"
              onPress={() => navigation.navigate("ScheduledOrders")}
              theme={theme}
            />
          </>
        )}
        {user?.role === "delivery_driver" && (
          <SettingItem
            icon="credit-card"
            label="Cuentas para recibir pagos"
            value="Bizum · Transferencia"
            onPress={() => navigation.navigate("PaymentWalletSetup")}
            theme={theme}
          />
        )}
      </View>

      {/* Driver Stats */}
      {user?.role === "delivery_driver" && driverStats && (
        <View style={[s.settingsCard, { backgroundColor: theme.card }]}>
          <Text style={[s.cardTitle, { color: theme.text }]}>
            Estado del Repartidor
          </Text>
          <View style={s.statsGrid}>
            <View style={[s.statBox, { backgroundColor: theme.bg }]}>
              <Text style={[s.statValue, { color: "#FF9800" }]}>
                {driverStats.rating > 0
                  ? (driverStats.rating / 10).toFixed(1)
                  : "—"}
              </Text>
              <Text style={[s.statLabel, { color: theme.sub }]}>Rating</Text>
            </View>
            <View style={[s.statBox, { backgroundColor: theme.bg }]}>
              <Text style={[s.statValue, { color: PRIMARY }]}>
                {driverStats.totalDeliveries}
              </Text>
              <Text style={[s.statLabel, { color: theme.sub }]}>Entregas</Text>
            </View>
            <View style={[s.statBox, { backgroundColor: theme.bg }]}>
              <Feather
                name={
                  driverStats.verificationStatus === "verified"
                    ? "check-circle"
                    : "clock"
                }
                size={24}
                color={
                  driverStats.verificationStatus === "verified"
                    ? "#4CAF50"
                    : "#F59E0B"
                }
              />
              <Text style={[s.statLabel, { color: theme.sub }]}>
                {driverStats.verificationStatus === "verified"
                  ? "Verificado"
                  : "Pendiente"}
              </Text>
            </View>
          </View>
          {driverStats.strikes > 0 && (
            <View
              style={[
                s.warningBox,
                { backgroundColor: "#FFF3E0", borderColor: "#FF9800" },
              ]}
            >
              <Feather name="alert-triangle" size={18} color="#FF9800" />
              <Text
                style={{
                  color: "#E65100",
                  marginLeft: 8,
                  flex: 1,
                  fontSize: 13,
                }}
              >
                Tienes {driverStats.strikes} strike
                {driverStats.strikes > 1 ? "s" : ""}. Con 3 strikes tu cuenta
                puede ser suspendida.
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function AdminProfileSection({ user, navigation, theme, onEditProfile }: any) {
  const [adminStats, setAdminStats] = useState<any>(null);

  useEffect(() => {
    apiRequest("GET", "/api/admin/profile/stats")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setAdminStats(data);
      })
      .catch(() => {});
  }, []);

  const isSuperAdmin = user?.role === "super_admin";
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("es-ES", {
        month: "long",
        year: "numeric",
      })
    : null;

  const quickLinks = [
    {
      label: "Comprobantes",
      icon: "file-text",
      color: "#06B6D4",
      count: adminStats?.pending?.proofs,
      screen: "DashboardTab",
      params: { section: "finance_proofs" },
    },
    {
      label: "Payouts",
      icon: "send",
      color: "#10B981",
      count: adminStats?.pending?.payouts,
      screen: "DashboardTab",
      params: { section: "finance_payouts" },
    },
    {
      label: "Pedidos activos",
      icon: "shopping-bag",
      color: "#3B82F6",
      count: adminStats?.pending?.orders,
      screen: "DashboardTab",
      params: { section: "orders_active" },
    },
  ];

  return (
    <View>
      {/* Identity card */}
      <Text style={[s.sectionTitle, { color: theme.text }]}>Mi Perfil</Text>
      <View
        style={[
          s.settingsCard,
          {
            backgroundColor: theme.card,
            borderLeftWidth: 4,
            borderLeftColor: isSuperAdmin ? "#7C3AED" : PRIMARY,
          },
        ]}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
            marginBottom: 16,
          }}
        >
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: (isSuperAdmin ? "#7C3AED" : PRIMARY) + "20",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontSize: 22,
                fontWeight: "900",
                color: isSuperAdmin ? "#7C3AED" : PRIMARY,
              }}
            >
              {user?.name?.charAt(0).toUpperCase() ?? "A"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{ fontSize: 17, fontWeight: "800", color: theme.text }}
            >
              {user?.name}
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                marginTop: 3,
              }}
            >
              <View
                style={{
                  backgroundColor: (isSuperAdmin ? "#7C3AED" : PRIMARY) + "15",
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: isSuperAdmin ? "#7C3AED" : PRIMARY,
                  }}
                >
                  {isSuperAdmin ? "⚡ Super Admin" : "🛡️ Admin"}
                </Text>
              </View>
            </View>
          </View>
        </View>
        <View style={{ gap: 8 }}>
          {user?.email ? (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Feather name="mail" size={14} color={theme.sub} />
              <Text style={{ fontSize: 13, color: theme.sub }}>
                {user.email}
              </Text>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Feather name="phone" size={14} color={theme.sub} />
            <Text style={{ fontSize: 13, color: theme.sub }}>
              {user?.phone || "Sin teléfono"}
            </Text>
          </View>
          {memberSince ? (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Feather name="calendar" size={14} color={theme.sub} />
              <Text style={{ fontSize: 13, color: theme.sub }}>
                Miembro desde {memberSince}
              </Text>
            </View>
          ) : null}
        </View>
        <Pressable
          onPress={onEditProfile}
          style={{
            marginTop: 14,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            backgroundColor: PRIMARY + "12",
            paddingVertical: 10,
            borderRadius: 10,
          }}
        >
          <Feather name="edit-2" size={14} color={PRIMARY} />
          <Text style={{ fontSize: 13, fontWeight: "700", color: PRIMARY }}>
            Editar perfil
          </Text>
        </Pressable>
      </View>

      {/* Quick access */}
      <Text style={[s.sectionTitle, { color: theme.text }]}>Acceso rápido</Text>
      <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
        {quickLinks.map((link) => (
          <Pressable
            key={link.params.section}
            onPress={() => navigation.navigate(link.screen, link.params)}
            style={[
              s.settingsCard,
              {
                flex: 1,
                backgroundColor: theme.card,
                alignItems: "center",
                paddingVertical: 18,
                marginBottom: 0,
              },
            ]}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: link.color + "20",
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <Feather name={link.icon as any} size={18} color={link.color} />
            </View>
            {link.count !== undefined ? (
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "900",
                  color: link.count > 0 ? link.color : theme.sub,
                }}
              >
                {link.count}
              </Text>
            ) : (
              <Text
                style={{ fontSize: 20, fontWeight: "900", color: theme.sub }}
              >
                —
              </Text>
            )}
            <Text
              style={{
                fontSize: 11,
                color: theme.sub,
                marginTop: 2,
                textAlign: "center",
              }}
            >
              {link.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Stats */}
      {adminStats?.stats && (
        <>
          <Text style={[s.sectionTitle, { color: theme.text }]}>
            Mi actividad
          </Text>
          <View style={[s.settingsCard, { backgroundColor: theme.card }]}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {[
                {
                  label: "Acciones totales",
                  value: adminStats.stats.totalActions,
                  icon: "activity",
                  color: PRIMARY,
                },
                {
                  label: "Verificaciones",
                  value: adminStats.stats.verificationsProcessed,
                  icon: "user-check",
                  color: "#10B981",
                },
                {
                  label: "Comprobantes",
                  value: adminStats.stats.proofsReviewed,
                  icon: "file-text",
                  color: "#06B6D4",
                },
                {
                  label: "Payouts",
                  value: adminStats.stats.payoutsProcessed,
                  icon: "send",
                  color: "#8B5CF6",
                },
              ].map((stat) => (
                <View
                  key={stat.label}
                  style={{
                    flex: 1,
                    minWidth: 120,
                    backgroundColor: theme.bg,
                    borderRadius: 12,
                    padding: 14,
                    alignItems: "center",
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: stat.color + "20",
                      justifyContent: "center",
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <Feather
                      name={stat.icon as any}
                      size={15}
                      color={stat.color}
                    />
                  </View>
                  <Text
                    style={{
                      fontSize: 22,
                      fontWeight: "900",
                      color: theme.text,
                    }}
                  >
                    {stat.value}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      color: theme.sub,
                      marginTop: 2,
                      textAlign: "center",
                    }}
                  >
                    {stat.label}
                  </Text>
                </View>
              ))}
            </View>
            {adminStats.stats.lastActionAt ? (
              <Text
                style={{
                  fontSize: 11,
                  color: theme.sub,
                  marginTop: 12,
                  textAlign: "center",
                }}
              >
                Última acción:{" "}
                {new Date(adminStats.stats.lastActionAt).toLocaleString(
                  "es-ES",
                )}
              </Text>
            ) : null}
          </View>
        </>
      )}

      {/* Config shortcuts */}
      <Text style={[s.sectionTitle, { color: theme.text }]}>Configuración</Text>
      <View style={[s.settingsCard, { backgroundColor: theme.card }]}>
        <SettingItem
          icon="sliders"
          label="Configuración de plataforma"
          onPress={() =>
            navigation.navigate("DashboardTab", { section: "settings" })
          }
          theme={theme}
        />
        <SettingItem
          icon="shield"
          label="Logs de auditoría"
          onPress={() =>
            navigation.navigate("DashboardTab", { section: "logs" })
          }
          theme={theme}
        />
      </View>
    </View>
  );
}

function BusinessProfileSection({
  user,
  navigation,
  theme,
  onEditProfile,
}: any) {
  // En web, las pantallas de negocio están en ProfileStackNavigatorWeb
  // Navegar directamente dentro del mismo stack
  const goToBusiness = (screen: string) => {
    try {
      // Las pantallas válidas están en ProfileStackNavigatorWeb
      const validScreens = [
        "BusinessHours",
        "BusinessOrders",
        "BusinessProducts",
        "BusinessStats",
        "BusinessDashboard",
        "MyBusinesses",
        "BusinessManage",
      ];
      if (validScreens.includes(screen)) {
        // Navegar directamente dentro del stack de perfil
        navigation.navigate(screen as any);
      } else {
        // Si no está en la lista, intentar ir altab Negocio
        const parent = navigation.getParent();
        if (parent) {
          parent.navigate("BusinessTab", { screen });
        } else {
          // Fallback: intentar navegación directa
          navigation.navigate("BusinessTab" as any, { screen } as any);
        }
      }
    } catch (e) {
      console.log("Navigation error:", e);
      // Último fallback: navegar a la pantalla de negocio si está disponible
      const parent = navigation.getParent();
      try {
        parent?.navigate("BusinessTab", { screen });
      } catch {
        // Si todo falla, simplemente navegar aBusinessDashboard
        navigation.navigate("BusinessDashboard" as any);
      }
    }
  };
  const [bizData, setBizData] = useState<any>(null);
  const [partnerLevel, setPartnerLevel] = useState<any>(null);
  const [paymentAccounts, setPaymentAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiRequest("GET", "/api/business/my-businesses").then((r) => r.json()),
      apiRequest("GET", "/api/business/partner-level").then((r) => r.json()),
      apiRequest("GET", "/api/payouts/accounts").then((r) => r.json()),
    ])
      .then(([biz, level, accounts]) => {
        setBizData(biz.businesses?.[0] || null);
        setPartnerLevel(level.success ? level : null);
        setPaymentAccounts(accounts.accounts || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const LEVEL_COLORS: Record<string, string> = {
    bronze: "#CD7F32",
    silver: "#9E9E9E",
    gold: "#FFD700",
    platinum: "#E5E4E2",
  };
  const LEVEL_ICONS: Record<string, string> = {
    bronze: "award",
    silver: "award",
    gold: "star",
    platinum: "zap",
  };
  const level = partnerLevel?.level || "bronze";
  const levelColor = LEVEL_COLORS[level] || "#CD7F32";
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <View>
      {/* ── Identidad ── */}
      <Text style={[s.sectionTitle, { color: theme.text }]}>Mi Perfil</Text>
      <View
        style={[
          s.settingsCard,
          {
            backgroundColor: theme.card,
            borderLeftWidth: 4,
            borderLeftColor: levelColor,
          },
        ]}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
            marginBottom: 16,
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: levelColor + "20",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text
              style={{ fontSize: 24, fontWeight: "900", color: levelColor }}
            >
              {user?.name?.charAt(0).toUpperCase() ?? "N"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{ fontSize: 17, fontWeight: "800", color: theme.text }}
            >
              {user?.name}
            </Text>
            <Text style={{ fontSize: 13, color: theme.sub, marginTop: 2 }}>
              {user?.phone}
            </Text>
            {user?.email ? (
              <Text style={{ fontSize: 12, color: theme.sub }}>
                {user.email}
              </Text>
            ) : null}
          </View>
          <View
            style={{
              backgroundColor: levelColor + "20",
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: levelColor + "40",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: levelColor,
                textTransform: "capitalize",
              }}
            >
              {level}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {memberSince ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                flex: 1,
              }}
            >
              <Feather name="calendar" size={13} color={theme.sub} />
              <Text style={{ fontSize: 12, color: theme.sub }}>
                Desde {memberSince}
              </Text>
            </View>
          ) : null}
          {user?.isActive ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: "#10B98115",
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
              }}
            >
              <Feather name="check-circle" size={12} color="#10B981" />
              <Text
                style={{ fontSize: 11, fontWeight: "700", color: "#10B981" }}
              >
                Aprobado
              </Text>
            </View>
          ) : (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: "#F59E0B15",
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
              }}
            >
              <Feather name="clock" size={12} color="#F59E0B" />
              <Text
                style={{ fontSize: 11, fontWeight: "700", color: "#F59E0B" }}
              >
                En revisión
              </Text>
            </View>
          )}
        </View>
        <Pressable
          onPress={onEditProfile}
          style={{
            marginTop: 14,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            backgroundColor: PRIMARY + "12",
            paddingVertical: 10,
            borderRadius: 10,
          }}
        >
          <Feather name="edit-2" size={14} color={PRIMARY} />
          <Text style={{ fontSize: 13, fontWeight: "700", color: PRIMARY }}>
            Editar datos personales
          </Text>
        </Pressable>
      </View>

      {/* ── Nivel de Partner ── */}
      <Text style={[s.sectionTitle, { color: theme.text }]}>
        Nivel de Partner
      </Text>
      <View style={[s.settingsCard, { backgroundColor: theme.card }]}>
        {loading ? (
          <ActivityIndicator color={PRIMARY} />
        ) : (
          <>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                marginBottom: 16,
              }}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: levelColor + "20",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Feather
                  name={LEVEL_ICONS[level] as any}
                  size={24}
                  color={levelColor}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "900",
                    color: levelColor,
                    textTransform: "capitalize",
                  }}
                >
                  {level}
                </Text>
                <Text style={{ fontSize: 12, color: theme.sub, marginTop: 2 }}>
                  {partnerLevel?.totalOrders || 0} pedidos · €
                  {((partnerLevel?.totalRevenue || 0) / 100).toFixed(0)}{" "}
                  generados
                </Text>
              </View>
            </View>
            {/* Barra de progreso al siguiente nivel */}
            {partnerLevel?.nextLevel && (
              <View style={{ marginBottom: 12 }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <Text style={{ fontSize: 12, color: theme.sub }}>
                    Progreso hacia {partnerLevel.nextLevel.level}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: levelColor,
                    }}
                  >
                    {Math.round((partnerLevel.progress || 0) * 100)}%
                  </Text>
                </View>
                <View
                  style={{
                    height: 8,
                    backgroundColor: theme.bg || "#f0f0f0",
                    borderRadius: 4,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      height: 8,
                      width:
                        `${Math.min((partnerLevel.progress || 0) * 100, 100)}%` as any,
                      backgroundColor: levelColor,
                      borderRadius: 4,
                    }}
                  />
                </View>
                <Text style={{ fontSize: 11, color: theme.sub, marginTop: 4 }}>
                  {partnerLevel.nextLevel.ordersNeeded} pedidos y €
                  {(partnerLevel.nextLevel.revenueNeeded / 100).toFixed(0)} más
                  para {partnerLevel.nextLevel.level}
                </Text>
              </View>
            )}
            {/* Beneficios activos */}
            <View style={{ gap: 8 }}>
              {(partnerLevel?.benefits || []).map((b: string, i: number) => (
                <View
                  key={i}
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <Feather name="check" size={14} color={levelColor} />
                  <Text style={{ fontSize: 13, color: theme.text }}>{b}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>

      {/* ── Mi Negocio ── */}
      {bizData && (
        <>
          <Text style={[s.sectionTitle, { color: theme.text }]}>
            Mi Negocio
          </Text>
          <View style={[s.settingsCard, { backgroundColor: theme.card }]}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                marginBottom: 14,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: PRIMARY + "15",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Feather name="briefcase" size={22} color={PRIMARY} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontSize: 16, fontWeight: "700", color: theme.text }}
                >
                  {bizData.name}
                </Text>
                <Text style={{ fontSize: 12, color: theme.sub }}>
                  {bizData.address || "Sin dirección"}
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: bizData.isOpen ? "#10B98115" : "#EF444415",
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 20,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: bizData.isOpen ? "#10B981" : "#EF4444",
                  }}
                >
                  {bizData.isOpen ? "Abierto" : "Cerrado"}
                </Text>
              </View>
            </View>
            <SettingItem
              icon="shopping-bag"
              label="Gestionar pedidos"
              onPress={() => goToBusiness("BusinessOrders")}
              theme={theme}
            />
            <SettingItem
              icon="package"
              label="Gestionar productos"
              onPress={() => goToBusiness("BusinessProducts")}
              theme={theme}
            />
            <SettingItem
              icon="clock"
              label="Horarios de atención"
              onPress={() => goToBusiness("BusinessHours")}
              theme={theme}
            />
            <SettingItem
              icon="bar-chart-2"
              label="Estadísticas"
              onPress={() => goToBusiness("BusinessStats")}
              theme={theme}
            />
            <SettingItem
              icon="map"
              label="Supervisión GPS en tiempo real"
              onPress={() => navigation.navigate("MapTab")}
              theme={theme}
            />
          </View>
        </>
      )}

      {/* ── Cuentas de cobro (resumen) ── */}
      <Text style={[s.sectionTitle, { color: theme.text }]}>
        Cuentas de Cobro
      </Text>
      <View style={[s.settingsCard, { backgroundColor: theme.card }]}>
        {paymentAccounts.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 16, gap: 8 }}>
            <Feather name="alert-circle" size={28} color="#F59E0B" />
            <Text
              style={{ fontSize: 14, color: theme.sub, textAlign: "center" }}
            >
              No tienes cuentas configuradas
            </Text>
            <Text
              style={{ fontSize: 12, color: theme.sub, textAlign: "center" }}
            >
              Necesitas configurar una cuenta para recibir tus pagos
            </Text>
          </View>
        ) : (
          paymentAccounts.slice(0, 3).map((acc: any, i: number) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingVertical: 10,
                borderBottomWidth: i < paymentAccounts.length - 1 ? 1 : 0,
                borderBottomColor: theme.border,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: PRIMARY + "15",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Feather
                  name={
                    acc.type === "bizum"
                      ? "smartphone"
                      : acc.type === "iban"
                        ? "credit-card"
                        : "dollar-sign"
                  }
                  size={16}
                  color={PRIMARY}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: theme.text,
                    textTransform: "capitalize",
                  }}
                >
                  {acc.type}
                </Text>
                <Text style={{ fontSize: 12, color: theme.sub }}>
                  {acc.accountNumber || acc.phone || acc.iban || "Configurado"}
                </Text>
              </View>
              <Feather name="check-circle" size={16} color="#10B981" />
            </View>
          ))
        )}
        <Pressable
          onPress={() => navigation.navigate("PaymentWalletSetup")}
          style={{
            marginTop: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            backgroundColor: PRIMARY + "12",
            paddingVertical: 10,
            borderRadius: 10,
          }}
        >
          <Feather name="settings" size={14} color={PRIMARY} />
          <Text style={{ fontSize: 13, fontWeight: "700", color: PRIMARY }}>
            Gestionar cuentas de cobro
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function BusinessPaymentsSection({ navigation, theme }: any) {
  const [finances, setFinances] = useState<any>(null);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiRequest("GET", "/api/business/finances").then((r) => r.json()),
      apiRequest("GET", "/api/business/payouts").then((r) => r.json()),
      apiRequest("GET", "/api/payouts/accounts").then((r) => r.json()),
    ])
      .then(([fin, pay, acc]) => {
        setFinances(fin.finances || fin);
        setPayouts(pay.payouts || []);
        setPaymentAccounts(acc.accounts || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const STATUS_COLOR: Record<string, string> = {
    pending: "#F59E0B",
    paid: "#10B981",
    processing: "#3B82F6",
  };
  const STATUS_LABEL: Record<string, string> = {
    pending: "Pendiente",
    paid: "Pagado",
    processing: "Procesando",
  };

  return (
    <View>
      {/* ── Resumen financiero ── */}
      <Text style={[s.sectionTitle, { color: theme.text }]}>
        Resumen Financiero
      </Text>
      {loading ? (
        <View
          style={[
            s.settingsCard,
            {
              backgroundColor: theme.card,
              alignItems: "center",
              paddingVertical: 32,
            },
          ]}
        >
          <ActivityIndicator color={PRIMARY} />
        </View>
      ) : (
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
          {[
            {
              label: "Balance disponible",
              value: `${((finances?.availableBalance || 0) / 100).toFixed(2)} €`,
              icon: "check-circle",
              color: "#10B981",
            },
            {
              label: "Pendiente de cobro",
              value: `${((finances?.pendingBalance || 0) / 100).toFixed(2)} €`,
              icon: "clock",
              color: "#F59E0B",
            },
            {
              label: "Total generado",
              value: `${((finances?.totalEarnings || 0) / 100).toFixed(2)} €`,
              icon: "trending-up",
              color: "#3B82F6",
            },
          ].map((item) => (
            <View
              key={item.label}
              style={[
                s.settingsCard,
                {
                  flex: 1,
                  backgroundColor: theme.card,
                  alignItems: "center",
                  paddingVertical: 20,
                  marginBottom: 0,
                },
              ]}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: item.color + "20",
                  justifyContent: "center",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <Feather name={item.icon as any} size={18} color={item.color} />
              </View>
              <Text
                style={{ fontSize: 20, fontWeight: "900", color: item.color }}
              >
                {item.value}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: theme.sub,
                  marginTop: 4,
                  textAlign: "center",
                }}
              >
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Cuentas de cobro ── */}
      <Text style={[s.sectionTitle, { color: theme.text }]}>
        Cuentas de Cobro
      </Text>
      <View style={[s.settingsCard, { backgroundColor: theme.card }]}>
        {paymentAccounts.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 20, gap: 10 }}>
            <Feather name="alert-circle" size={32} color="#F59E0B" />
            <Text
              style={{ fontSize: 14, fontWeight: "600", color: theme.text }}
            >
              Sin cuentas configuradas
            </Text>
            <Text
              style={{ fontSize: 12, color: theme.sub, textAlign: "center" }}
            >
              Configura tu Bizum o IBAN para recibir los pagos de tus pedidos
            </Text>
          </View>
        ) : (
          paymentAccounts.map((acc: any, i: number) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 12,
                borderBottomWidth: i < paymentAccounts.length - 1 ? 1 : 0,
                borderBottomColor: theme.border,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: PRIMARY + "15",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Feather
                  name={acc.type === "bizum" ? "smartphone" : "credit-card"}
                  size={18}
                  color={PRIMARY}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: theme.text,
                    textTransform: "capitalize",
                  }}
                >
                  {acc.type}
                </Text>
                <Text style={{ fontSize: 12, color: theme.sub }}>
                  {acc.accountNumber || acc.phone || acc.iban || "Configurado"}
                </Text>
                {acc.holderName ? (
                  <Text style={{ fontSize: 11, color: theme.sub }}>
                    {acc.holderName}
                  </Text>
                ) : null}
              </View>
              <View
                style={{
                  backgroundColor: "#10B98115",
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 8,
                }}
              >
                <Text
                  style={{ fontSize: 11, fontWeight: "700", color: "#10B981" }}
                >
                  Activa
                </Text>
              </View>
            </View>
          ))
        )}
        <Pressable
          onPress={() => navigation.navigate("PaymentWalletSetup")}
          style={{
            marginTop: 14,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            backgroundColor: PRIMARY,
            paddingVertical: 12,
            borderRadius: 10,
          }}
        >
          <Feather name="plus" size={15} color="#fff" />
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>
            Añadir / Editar cuenta
          </Text>
        </Pressable>
      </View>

      {/* ── Historial de payouts ── */}
      <Text style={[s.sectionTitle, { color: theme.text }]}>
        Historial de Pagos
      </Text>
      <View style={[s.settingsCard, { backgroundColor: theme.card }]}>
        {payouts.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 20, gap: 8 }}>
            <Feather name="inbox" size={32} color={theme.sub} />
            <Text style={{ fontSize: 14, color: theme.sub }}>
              No hay pagos registrados
            </Text>
          </View>
        ) : (
          payouts.slice(0, 8).map((p: any, i: number) => (
            <View
              key={p.id || i}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 12,
                borderBottomWidth: i < Math.min(payouts.length, 8) - 1 ? 1 : 0,
                borderBottomColor: theme.border,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: (STATUS_COLOR[p.status] || "#999") + "20",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Feather
                  name="send"
                  size={16}
                  color={STATUS_COLOR[p.status] || "#999"}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontSize: 14, fontWeight: "700", color: theme.text }}
                >
                  {((p.amount || 0) / 100).toFixed(2)} €
                </Text>
                <Text style={{ fontSize: 12, color: theme.sub }}>
                  {p.createdAt
                    ? new Date(p.createdAt).toLocaleDateString("es-ES")
                    : ""}
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: (STATUS_COLOR[p.status] || "#999") + "20",
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: STATUS_COLOR[p.status] || "#999",
                  }}
                >
                  {STATUS_LABEL[p.status] || p.status}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

function BusinessSection({ navigation, theme }: any) {
  return (
    <View>
      <Text style={[s.sectionTitle, { color: theme.text }]}>Mi Negocio</Text>
      <View style={[s.settingsCard, { backgroundColor: theme.card }]}>
        <SettingItem
          icon="briefcase"
          label="Mis Negocios"
          onPress={() => navigation.navigate("MyBusinesses")}
          theme={theme}
        />
        <SettingItem
          icon="clock"
          label="Horarios de atención"
          onPress={() => navigation.navigate("BusinessHours")}
          theme={theme}
        />
        <SettingItem
          icon="map-pin"
          label="Zonas de entrega"
          onPress={() => navigation.navigate("DeliveryConfig")}
          theme={theme}
        />
        <SettingItem
          icon="settings"
          label="Configuración del negocio"
          onPress={() => navigation.navigate("BusinessManage")}
          theme={theme}
        />
      </View>
    </View>
  );
}

function PaymentsSection({ navigation, theme }: any) {
  return (
    <View>
      <Text style={[s.sectionTitle, { color: theme.text }]}>Pagos</Text>
      <View style={[s.settingsCard, { backgroundColor: theme.card }]}>
        <SettingItem
          icon="credit-card"
          label="Cuentas para recibir pagos"
          value="Bizum · Transferencia"
          onPress={() => navigation.navigate("PaymentWalletSetup")}
          theme={theme}
        />
        <SettingItem
          icon="dollar-sign"
          label="Historial de pagos"
          onPress={() => navigation.navigate("BusinessFinances")}
          theme={theme}
        />
      </View>
    </View>
  );
}

function PreferencesSection({
  themeMode,
  setThemeMode,
  settings,
  updateSettings,
  showToast,
  theme,
}: any) {
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

  return (
    <View>
      <Text style={[s.sectionTitle, { color: theme.text }]}>Preferencias</Text>

      <View style={[s.settingsCard, { backgroundColor: theme.card }]}>
        <SettingItem
          icon="moon"
          label="Tema"
          value={getThemeLabel(themeMode)}
          onPress={() => {}}
          theme={theme}
        />
        <View style={s.themeButtons}>
          {(["system", "light", "dark"] as ThemeMode[]).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => setThemeMode(mode)}
              style={[
                s.themeBtn,
                {
                  backgroundColor: themeMode === mode ? PRIMARY : theme.bg,
                  borderColor: themeMode === mode ? PRIMARY : theme.border,
                },
              ]}
            >
              <Feather
                name={
                  mode === "system"
                    ? "smartphone"
                    : mode === "light"
                      ? "sun"
                      : "moon"
                }
                size={16}
                color={themeMode === mode ? "#FFF" : theme.sub}
              />
              <Text
                style={[
                  s.themeBtnText,
                  { color: themeMode === mode ? "#FFF" : theme.text },
                ]}
              >
                {mode === "system"
                  ? "Sistema"
                  : mode === "light"
                    ? "Claro"
                    : "Oscuro"}
              </Text>
            </Pressable>
          ))}
        </View>

        <SettingItem
          icon="bell"
          label="Notificaciones"
          value={settings.notificationsEnabled ? "Activadas" : "Desactivadas"}
          onPress={async () => {
            await updateSettings({
              notificationsEnabled: !settings.notificationsEnabled,
            });
            showToast(
              settings.notificationsEnabled
                ? "Notificaciones desactivadas"
                : "Notificaciones activadas",
              "info",
            );
          }}
          theme={theme}
        />

        <SettingItem
          icon="globe"
          label="Idioma"
          value="Español"
          onPress={() => {}}
          theme={theme}
        />
      </View>
    </View>
  );
}

function MoreSection({ navigation, theme }: any) {
  return (
    <View>
      <Text style={[s.sectionTitle, { color: theme.text }]}>Más</Text>

      <View style={[s.settingsCard, { backgroundColor: theme.card }]}>
        <SettingItem
          icon="share-2"
          label="Compartir ComeYa"
          onPress={() => {
            if (navigator.share) {
              navigator.share({
                title: "ComeYa - Delivery Local",
                text: "Descubre ComeYa - Tu delivery local de confianza en Soria.",
                url: "https://comeya.es",
              });
            }
          }}
          theme={theme}
        />

        <SettingItem
          icon="help-circle"
          label="Ayuda y soporte"
          onPress={() => navigation.navigate("Support")}
          theme={theme}
        />
        <SettingItem
          icon="file-text"
          label="Términos y condiciones"
          onPress={() => navigation.navigate("Terms")}
          theme={theme}
        />
        <SettingItem
          icon="shield"
          label="Política de privacidad"
          onPress={() => navigation.navigate("Privacy")}
          theme={theme}
        />
      </View>

      <Text style={[s.version, { color: theme.sub }]}>ComeYa v1.0.0</Text>
    </View>
  );
}

function SettingItem({ icon, label, value, onPress, theme }: any) {
  return (
    <Pressable onPress={onPress} style={s.settingItem}>
      <View style={[s.settingIcon, { backgroundColor: PRIMARY + "15" }]}>
        <Feather name={icon} size={18} color={PRIMARY} />
      </View>
      <View style={s.settingContent}>
        <Text style={[s.settingLabel, { color: theme.text }]}>{label}</Text>
        {value && (
          <Text style={[s.settingValue, { color: theme.sub }]}>{value}</Text>
        )}
      </View>
      <Feather name="chevron-right" size={18} color={theme.sub} />
    </Pressable>
  );
}

function EditProfileModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState<"datos" | "seguridad">("datos");
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [dni, setDni] = useState((user as any)?.dni || "");
  const [address, setAddress] = useState((user as any)?.address || "");
  const [isSaving, setIsSaving] = useState(false);
  // Cambio de contraseña
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // Cambio de teléfono
  const [newPhone, setNewPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);

  useEffect(() => {
    if (visible) {
      setTab("datos");
      setName(user?.name || "");
      setEmail(user?.email || "");
      setDni((user as any)?.dni || "");
      setAddress((user as any)?.address || "");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNewPhone("");
      setPhoneCode("");
      setCodeSent(false);
    }
  }, [visible, user]);

  const handleSave = async () => {
    if (!name.trim()) {
      showToast("El nombre es obligatorio", "error");
      return;
    }
    setIsSaving(true);
    try {
      const res = await apiRequest("PUT", "/api/users/profile", {
        name,
        email,
        dni,
        address,
      });
      const data = await res.json();
      if (data.success || res.ok) {
        updateUser({ ...user, name, email, dni, address });
        showToast("Perfil actualizado", "success");
        onClose();
      } else {
        showToast(
          typeof data.error === "string" ? data.error : "Error al guardar",
          "error",
        );
      }
    } catch {
      showToast("Error de conexión", "error");
    }
    setIsSaving(false);
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      showToast("Rellena todos los campos", "error");
      return;
    }
    if (newPassword.length < 8) {
      showToast("Mínimo 8 caracteres", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("Las contraseñas no coinciden", "error");
      return;
    }
    setIsSaving(true);
    try {
      const res = await apiRequest("PUT", "/api/auth/change-password", {
        currentPassword,
        newPassword,
      });
      const data = await res.json();
      if (data.success) {
        showToast("Contraseña actualizada", "success");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        showToast(
          typeof data.error === "string"
            ? data.error
            : "Error al cambiar contraseña",
          "error",
        );
      }
    } catch {
      showToast("Error de conexión", "error");
    }
    setIsSaving(false);
  };

  const handleSendPhoneCode = async () => {
    if (!newPhone.trim()) {
      showToast("Introduce el nuevo teléfono", "error");
      return;
    }
    setIsSendingCode(true);
    try {
      const res = await apiRequest("POST", "/api/auth/send-code", {
        phone: newPhone,
      });
      const data = await res.json();
      if (data.userNotFound || data.success) {
        setCodeSent(true);
        showToast("Código enviado al nuevo número", "success");
      } else {
        showToast(
          typeof data.error === "string"
            ? data.error
            : "Error al enviar código",
          "error",
        );
      }
    } catch {
      showToast("Error de conexión", "error");
    }
    setIsSendingCode(false);
  };

  const handleChangePhone = async () => {
    if (!phoneCode.trim()) {
      showToast("Introduce el código", "error");
      return;
    }
    setIsSaving(true);
    try {
      const res = await apiRequest("PUT", "/api/auth/change-phone", {
        newPhone,
        code: phoneCode,
      });
      const data = await res.json();
      if (data.success) {
        updateUser({ ...user, phone: newPhone });
        showToast("Teléfono actualizado", "success");
        setNewPhone("");
        setPhoneCode("");
        setCodeSent(false);
        onClose();
      } else {
        showToast(
          typeof data.error === "string"
            ? data.error
            : "Error al cambiar teléfono",
          "error",
        );
      }
    } catch {
      showToast("Error de conexión", "error");
    }
    setIsSaving(false);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={modalStyles.overlay}>
        <View style={[modalStyles.container, { backgroundColor: card }]}>
          <View style={modalStyles.header}>
            <Text style={[modalStyles.title, { color: text }]}>
              Editar perfil
            </Text>
            <Pressable onPress={onClose}>
              <Feather name="x" size={24} color={sub} />
            </Pressable>
          </View>

          {/* Tabs */}
          <View
            style={{
              flexDirection: "row",
              borderBottomWidth: 1,
              borderBottomColor: border,
            }}
          >
            {(["datos", "seguridad"] as const).map((t) => (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  alignItems: "center",
                  borderBottomWidth: 2,
                  borderBottomColor: tab === t ? PRIMARY : "transparent",
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: tab === t ? PRIMARY : sub,
                    textTransform: "capitalize",
                  }}
                >
                  {t === "datos" ? "Datos personales" : "Seguridad"}
                </Text>
              </Pressable>
            ))}
          </View>

          <ScrollView style={modalStyles.content}>
            {tab === "datos" && (
              <>
                <Text style={[modalStyles.label, { color: sub }]}>
                  Nombre completo *
                </Text>
                <TextInput
                  style={[
                    modalStyles.input,
                    {
                      backgroundColor: inputBg,
                      color: text,
                      borderColor: border,
                    },
                  ]}
                  value={name}
                  onChangeText={setName}
                  placeholder="Tu nombre"
                  placeholderTextColor={sub}
                />
                <Text style={[modalStyles.label, { color: sub }]}>
                  DNI / NIE
                </Text>
                <TextInput
                  style={[
                    modalStyles.input,
                    {
                      backgroundColor: inputBg,
                      color: text,
                      borderColor: border,
                    },
                  ]}
                  value={dni}
                  onChangeText={setDni}
                  placeholder="12345678A"
                  placeholderTextColor={sub}
                />
                <Text style={[modalStyles.label, { color: sub }]}>
                  Email (opcional)
                </Text>
                <TextInput
                  style={[
                    modalStyles.input,
                    {
                      backgroundColor: inputBg,
                      color: text,
                      borderColor: border,
                    },
                  ]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="tu@email.com"
                  placeholderTextColor={sub}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Text style={[modalStyles.label, { color: sub }]}>
                  Dirección
                </Text>
                <TextInput
                  style={[
                    modalStyles.input,
                    {
                      backgroundColor: inputBg,
                      color: text,
                      borderColor: border,
                    },
                  ]}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Tu dirección"
                  placeholderTextColor={sub}
                />
                <TouchableOpacity
                  style={[
                    modalStyles.saveBtn,
                    { opacity: isSaving ? 0.6 : 1, marginTop: 20 },
                  ]}
                  onPress={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={modalStyles.saveBtnText}>Guardar cambios</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {tab === "seguridad" && (
              <>
                {/* Cambio de contraseña */}
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: text,
                    marginTop: 8,
                    marginBottom: 12,
                  }}
                >
                  Cambiar contraseña
                </Text>
                <Text style={[modalStyles.label, { color: sub }]}>
                  Contraseña actual
                </Text>
                <TextInput
                  style={[
                    modalStyles.input,
                    {
                      backgroundColor: inputBg,
                      color: text,
                      borderColor: border,
                    },
                  ]}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="••••••••"
                  placeholderTextColor={sub}
                  secureTextEntry
                />
                <Text style={[modalStyles.label, { color: sub }]}>
                  Nueva contraseña
                </Text>
                <TextInput
                  style={[
                    modalStyles.input,
                    {
                      backgroundColor: inputBg,
                      color: text,
                      borderColor: border,
                    },
                  ]}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Mínimo 8 caracteres"
                  placeholderTextColor={sub}
                  secureTextEntry
                />
                <Text style={[modalStyles.label, { color: sub }]}>
                  Confirmar nueva contraseña
                </Text>
                <TextInput
                  style={[
                    modalStyles.input,
                    {
                      backgroundColor: inputBg,
                      color: text,
                      borderColor: border,
                    },
                  ]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Repite la contraseña"
                  placeholderTextColor={sub}
                  secureTextEntry
                />
                <TouchableOpacity
                  style={[
                    modalStyles.saveBtn,
                    { opacity: isSaving ? 0.6 : 1, marginTop: 12 },
                  ]}
                  onPress={handleChangePassword}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={modalStyles.saveBtnText}>
                      Cambiar contraseña
                    </Text>
                  )}
                </TouchableOpacity>

                {/* Separador */}
                <View
                  style={{
                    height: 1,
                    backgroundColor: border,
                    marginVertical: 24,
                  }}
                />

                {/* Cambio de teléfono */}
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: text,
                    marginBottom: 4,
                  }}
                >
                  Cambiar número de teléfono
                </Text>
                <Text style={{ fontSize: 12, color: sub, marginBottom: 12 }}>
                  Teléfono actual: {user?.phone}
                </Text>
                <Text style={[modalStyles.label, { color: sub }]}>
                  Nuevo número
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TextInput
                    style={[
                      modalStyles.input,
                      {
                        flex: 1,
                        backgroundColor: inputBg,
                        color: text,
                        borderColor: border,
                      },
                    ]}
                    value={newPhone}
                    onChangeText={setNewPhone}
                    placeholder="+34 6XX XXX XXX"
                    placeholderTextColor={sub}
                    keyboardType="phone-pad"
                    editable={!codeSent}
                  />
                  <TouchableOpacity
                    onPress={handleSendPhoneCode}
                    disabled={isSendingCode || codeSent}
                    style={{
                      backgroundColor: codeSent ? "#10B981" : PRIMARY,
                      paddingHorizontal: 14,
                      borderRadius: 10,
                      justifyContent: "center",
                      opacity: isSendingCode || codeSent ? 0.7 : 1,
                    }}
                  >
                    {isSendingCode ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text
                        style={{
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: "700",
                        }}
                      >
                        {codeSent ? "✓ Enviado" : "Enviar código"}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
                {codeSent && (
                  <>
                    <Text style={[modalStyles.label, { color: sub }]}>
                      Código de verificación
                    </Text>
                    <TextInput
                      style={[
                        modalStyles.input,
                        {
                          backgroundColor: inputBg,
                          color: text,
                          borderColor: border,
                        },
                      ]}
                      value={phoneCode}
                      onChangeText={setPhoneCode}
                      placeholder="123456"
                      placeholderTextColor={sub}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                    <TouchableOpacity
                      style={[
                        modalStyles.saveBtn,
                        { opacity: isSaving ? 0.6 : 1, marginTop: 12 },
                      ]}
                      onPress={handleChangePhone}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={modalStyles.saveBtnText}>
                          Confirmar nuevo teléfono
                        </Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}
          </ScrollView>

          <View
            style={[
              modalStyles.footer,
              { borderTopWidth: 1, borderTopColor: border },
            ]}
          >
            <TouchableOpacity
              style={[modalStyles.cancelBtn, { borderColor: border }]}
              onPress={onClose}
            >
              <Text style={[modalStyles.cancelBtnText, { color: text }]}>
                Cerrar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const card = "#fff";
const text = "#111";
const sub = "#666";
const border = "#e0e0e0";
const inputBg = "#f5f5f5";

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    borderRadius: 16,
    width: "100%",
    maxWidth: 480,
    maxHeight: "85%",
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  title: { fontSize: 18, fontWeight: "700" },
  content: { padding: 20 },
  label: { fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  cancelBtnText: { fontSize: 14, fontWeight: "600" },
  saveBtn: {
    flex: 1,
    backgroundColor: PRIMARY,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "row" },
  sidebar: { width: 280, borderRightWidth: 1, flexDirection: "column" as any },
  sideHeader: { padding: 24, alignItems: "center", borderBottomWidth: 1 },
  businessHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  avatarContainer: { position: "relative" },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  userName: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  userPhone: { fontSize: 13, marginBottom: 12 },
  badges: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  roleBadgeText: { fontSize: 11, fontWeight: "700" },
  sideNav: { paddingVertical: 16 },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  navItemActive: {
    backgroundColor: PRIMARY + "10",
    borderRightWidth: 3,
    borderRightColor: PRIMARY,
  },
  navItemText: { fontSize: 14, fontWeight: "600" },
  sideFooter: {
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    padding: 16,
    paddingBottom: 32,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  logoutBtnText: { fontSize: 14, fontWeight: "600" },
  main: { flex: 1 },
  mainContent: { padding: 32, maxWidth: 800 },
  sectionTitle: { fontSize: 22, fontWeight: "800", marginBottom: 16 },
  settingsCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 16 },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  settingContent: { flex: 1 },
  settingLabel: { fontSize: 14, fontWeight: "600" },
  settingValue: { fontSize: 12, marginTop: 2 },
  statsGrid: { flexDirection: "row", gap: 12, marginBottom: 16 },
  statBox: { flex: 1, padding: 16, borderRadius: 12, alignItems: "center" },
  statValue: { fontSize: 24, fontWeight: "900", marginBottom: 4 },
  statLabel: { fontSize: 11 },
  warningBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
  },
  themeButtons: { flexDirection: "row", gap: 8, marginVertical: 12 },
  themeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  themeBtnText: { fontSize: 12, fontWeight: "600" },
  version: { textAlign: "center", fontSize: 12, marginTop: 20 },
  // Móvil
  mobileNav: { borderBottomWidth: 1 },
  mobileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
  },
  avatarSmall: { width: 44, height: 44, borderRadius: 22 },
  mobileTabs: { flexDirection: "row" },
  mobileTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  mobileTabText: { fontSize: 12, fontWeight: "600" },
});
