import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Pressable, Text, ActivityIndicator, Platform } from "react-native";
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
  if (profileImage.startsWith('data:image/')) return profileImage;
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
    } catch { return profileImage; }
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
      ]).then(([statusRes, profileRes]) => Promise.all([statusRes.json(), profileRes.json()]))
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
        }).catch(console.error);
    }
  }, [user?.role]);

  useEffect(() => {
    if (user) {
      apiRequest("GET", "/api/user/profile").then(r => r.json()).then(data => {
        if (data.success && data.user?.profileImage) {
          const img = data.user.profileImage;
          if (img.startsWith('data:image/')) {
            setProfileImage(img);
          } else {
            const version = Date.now();
            setProfileImage(`${resolveProfileImageUrl(img)}?v=${version}`);
          }
          updateUser({ profileImage: img });
        }
      }).catch(console.error);
    }
  }, []);

  const pickImage = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
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
        throw new Error("La imagen es muy pesada. Usa una foto más ligera (~2MB max)");
      }

      const apiResponse = await apiRequest("POST", "/api/user/profile-image", { image: imageData });
      const data = await apiResponse.json();

      if (data.success && data.profileImage) {
        const img = data.profileImage;
        const fullUrl = img.startsWith('data:image/') ? img : `${resolveProfileImageUrl(img)}?v=${Date.now()}`;
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
    const ok = await confirm({ title: "Cerrar sesión", message: "¿Estás seguro que deseas salir?", confirmLabel: "Salir", cancelLabel: "Cancelar", variant: "warning" });
    if (ok) logout();
  };

  const getRoleLabel = () => {
    switch (user?.role) {
      case "customer": return "Cliente";
      case "business_owner": return "Dueño de Negocio";
      case "delivery_driver": return "Repartidor";
      case "admin":
      case "super_admin": return "ComeYa";
      default: return user?.role || "Usuario";
    }
  };

  const approvalStatus = (user?.role === "business_owner" || user?.role === "delivery_driver")
    ? user?.isActive
      ? { text: "Aprobado", variant: "success" as const }
      : { text: "En revisión", variant: "warning" as const }
    : null;

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      {/* Sidebar: BusinessSidebar para business_owner, propio para el resto */}
      {isBusiness ? (
        <MobileSidebarWrapper title="Mi Perfil" sidebarStyle={[s.sidebar, { backgroundColor: card, borderRightColor: border }]}>
          <View style={[s.sideHeader, { borderBottomColor: border }]}>
            <Pressable style={s.avatarContainer} onPress={pickImage} disabled={isUploadingImage}>
              <Image
                source={profileImage ? { uri: profileImage } : require("../../assets/images/avatar-placeholder.png")}
                style={[s.avatar, isUploadingImage && { opacity: 0.5 }]}
                onError={() => setProfileImage(null)}
                contentFit="cover"
              />
              {isUploadingImage ? (
                <View style={[s.editBadge, { backgroundColor: PRIMARY }]}><ActivityIndicator size="small" color="#FFF" /></View>
              ) : (
                <View style={[s.editBadge, { backgroundColor: PRIMARY }]}><Feather name="camera" size={12} color="#FFF" /></View>
              )}
            </Pressable>
            <Text style={[s.userName, { color: text }]}>{user?.name || "Usuario"}</Text>
            <Text style={[s.userPhone, { color: sub }]}>{user?.phone || "Sin teléfono"}</Text>
            <View style={s.badges}>
              <View style={[s.roleBadge, { backgroundColor: PRIMARY + "15" }]}>
                <Text style={[s.roleBadgeText, { color: PRIMARY }]}>{getRoleLabel()}</Text>
              </View>
              {approvalStatus && (
                <View style={[s.roleBadge, { backgroundColor: approvalStatus.variant === "success" ? "#4CAF5020" : "#F59E0B20" }]}>
                  <Text style={[s.roleBadgeText, { color: approvalStatus.variant === "success" ? "#4CAF50" : "#F59E0B" }]}>{approvalStatus.text}</Text>
                </View>
              )}
            </View>
          </View>
          <View style={s.sideNav}>
            {[
              { id: "account", label: "Cuenta", icon: "user" },
              { id: "preferences", label: "Preferencias", icon: "settings" },
              { id: "more", label: "Más", icon: "grid" },
            ].map(item => (
              <Pressable key={item.id} onPress={() => setActiveSection(item.id)} style={[s.navItem, activeSection === item.id && s.navItemActive]}>
                <Feather name={item.icon as any} size={18} color={activeSection === item.id ? PRIMARY : sub} />
                <Text style={[s.navItemText, { color: activeSection === item.id ? PRIMARY : text }]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={[s.sideFooter, { borderTopColor: border }]}>
            <Pressable onPress={handleLogout} style={s.logoutBtn}>
              <Feather name="log-out" size={18} color="#EF4444" />
              <Text style={[s.logoutBtnText, { color: "#EF4444" }]}>Cerrar sesión</Text>
            </Pressable>
          </View>
        </MobileSidebarWrapper>
      ) : (
        <MobileSidebarWrapper title="Mi Perfil" sidebarStyle={[s.sidebar, { backgroundColor: card, borderRightColor: border }]}>
          {/* Profile Header */}
          <View style={[s.sideHeader, { borderBottomColor: border }]}>
            <Pressable style={s.avatarContainer} onPress={pickImage} disabled={isUploadingImage}>
              <Image
                source={profileImage ? { uri: profileImage } : require("../../assets/images/avatar-placeholder.png")}
                style={[s.avatar, isUploadingImage && { opacity: 0.5 }]}
                onError={() => setProfileImage(null)}
                contentFit="cover"
              />
              {isUploadingImage ? (
                <View style={[s.editBadge, { backgroundColor: PRIMARY }]}><ActivityIndicator size="small" color="#FFF" /></View>
              ) : (
                <View style={[s.editBadge, { backgroundColor: PRIMARY }]}><Feather name="camera" size={12} color="#FFF" /></View>
              )}
            </Pressable>
            <Text style={[s.userName, { color: text }]}>{user?.name || "Usuario"}</Text>
            <Text style={[s.userPhone, { color: sub }]}>{user?.phone || "Sin teléfono"}</Text>
            <View style={s.badges}>
              <View style={[s.roleBadge, { backgroundColor: PRIMARY + "15" }]}>
                <Text style={[s.roleBadgeText, { color: PRIMARY }]}>{getRoleLabel()}</Text>
              </View>
              {approvalStatus && (
                <View style={[s.roleBadge, { backgroundColor: approvalStatus.variant === "success" ? "#4CAF5020" : "#F59E0B20" }]}>
                  <Text style={[s.roleBadgeText, { color: approvalStatus.variant === "success" ? "#4CAF50" : "#F59E0B" }]}>{approvalStatus.text}</Text>
                </View>
              )}
            </View>
          </View>
          <View style={s.sideNav}>
            {[
              { id: "account", label: "Cuenta", icon: "user" },
              { id: "preferences", label: "Preferencias", icon: "settings" },
              { id: "more", label: "Más", icon: "grid" },
            ].map(item => (
              <Pressable key={item.id} onPress={() => setActiveSection(item.id)} style={[s.navItem, activeSection === item.id && s.navItemActive]}>
                <Feather name={item.icon as any} size={18} color={activeSection === item.id ? PRIMARY : sub} />
                <Text style={[s.navItemText, { color: activeSection === item.id ? PRIMARY : text }]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={[s.sideFooter, { borderTopColor: border }]}>
            <Pressable onPress={handleLogout} style={s.logoutBtn}>
              <Feather name="log-out" size={18} color="#EF4444" />
              <Text style={[s.logoutBtnText, { color: "#EF4444" }]}>Cerrar sesión</Text>
            </Pressable>
          </View>
        </MobileSidebarWrapper>
      )}

      {/* CONTENT */}
      <ScrollView style={s.main} contentContainerStyle={s.mainContent} showsVerticalScrollIndicator={false}>
        {/* Nav horizontal móvil */}
        {isMobile && (
          <View style={[s.mobileNav, { backgroundColor: card, borderBottomColor: border }]}>
            {/* Avatar compacto */}
            <View style={[s.mobileHeader, { borderBottomColor: border }]}>
              <Pressable style={s.avatarContainer} onPress={pickImage} disabled={isUploadingImage}>
                <Image
                  source={profileImage ? { uri: profileImage } : require("../../assets/images/avatar-placeholder.png")}
                  style={s.avatarSmall}
                  onError={() => setProfileImage(null)}
                  contentFit="cover"
                />
                <View style={[s.editBadge, { backgroundColor: PRIMARY }]}>
                  {isUploadingImage ? <ActivityIndicator size="small" color="#FFF" /> : <Feather name="camera" size={10} color="#FFF" />}
                </View>
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={[s.userName, { color: text, fontSize: 15, marginBottom: 0 }]}>{user?.name || "Usuario"}</Text>
                <Text style={[s.userPhone, { color: sub, marginBottom: 0 }]}>{user?.phone || ""}</Text>
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
              ].map(item => (
                <Pressable key={item.id} onPress={() => setActiveSection(item.id)}
                  style={[s.mobileTab, activeSection === item.id && { borderBottomColor: PRIMARY, borderBottomWidth: 2 }]}>
                  <Feather name={item.icon as any} size={16} color={activeSection === item.id ? PRIMARY : sub} />
                  <Text style={[s.mobileTabText, { color: activeSection === item.id ? PRIMARY : sub }]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
        {/* Avatar header para business (el sidebar no lo muestra) */}
        {isBusiness && (
          <View style={[s.businessHeader, { backgroundColor: card, borderColor: border }]}>
            <Pressable style={s.avatarContainer} onPress={pickImage} disabled={isUploadingImage}>
              <Image
                source={profileImage ? { uri: profileImage } : require("../../assets/images/avatar-placeholder.png")}
                style={[s.avatar, isUploadingImage && { opacity: 0.5 }]}
                onError={() => setProfileImage(null)}
                contentFit="cover"
              />
              {isUploadingImage ? (
                <View style={[s.editBadge, { backgroundColor: PRIMARY }]}><ActivityIndicator size="small" color="#FFF" /></View>
              ) : (
                <View style={[s.editBadge, { backgroundColor: PRIMARY }]}><Feather name="camera" size={12} color="#FFF" /></View>
              )}
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={[s.userName, { color: text, textAlign: "left", marginBottom: 2 }]}>{user?.name || "Usuario"}</Text>
              <Text style={[s.userPhone, { color: sub, textAlign: "left" }]}>{user?.phone || "Sin teléfono"}</Text>
            </View>
            <View style={[s.roleBadge, { backgroundColor: PRIMARY + "15" }]}>
              <Text style={[s.roleBadgeText, { color: PRIMARY }]}>{getRoleLabel()}</Text>
            </View>
            {approvalStatus && (
              <View style={[s.roleBadge, { backgroundColor: approvalStatus.variant === "success" ? "#4CAF5020" : "#F59E0B20" }]}>
                <Text style={[s.roleBadgeText, { color: approvalStatus.variant === "success" ? "#4CAF50" : "#F59E0B" }]}>{approvalStatus.text}</Text>
              </View>
            )}
          </View>
        )}
        {activeSection === "account" && (
          <AccountSection user={user} navigation={navigation} driverStats={driverStats} theme={{ bg, card, text, sub, border }} />
        )}
        {activeSection === "payments" && isBusiness && (
          <PaymentsSection navigation={navigation} theme={{ bg, card, text, sub, border }} />
        )}
        {activeSection === "preferences" && (
          <PreferencesSection themeMode={themeMode} setThemeMode={setThemeMode} settings={settings} updateSettings={updateSettings} showToast={showToast} theme={{ bg, card, text, sub, border }} />
        )}
        {activeSection === "more" && (
          <MoreSection navigation={navigation} theme={{ bg, card, text, sub, border }} />
        )}
      </ScrollView>
    </View>
  );
}

// Componentes de secciones (continuará en siguiente parte)
function AccountSection({ user, navigation, driverStats, theme }: any) {
  return (
    <View>
      <Text style={[s.sectionTitle, { color: theme.text }]}>Cuenta</Text>
      <View style={[s.settingsCard, { backgroundColor: theme.card }]}>
        <SettingItem icon="user" label="Editar mi perfil" onPress={() => navigation.navigate("EditProfile")} theme={theme} />
        {user?.role === "customer" && (
          <>
            <SettingItem icon="map-pin" label="Direcciones guardadas" onPress={() => navigation.navigate("SavedAddresses")} theme={theme} />
            <SettingItem icon="credit-card" label="Métodos de pago" value="Bizum · Tarjeta · PayPal" onPress={() => navigation.navigate("PaymentWalletSetup")} theme={theme} />
            <SettingItem icon="gift" label="Mis puntos y recompensas" onPress={() => navigation.navigate("Gamification")} theme={theme} />
            <SettingItem icon="star" label="Suscripciones" onPress={() => navigation.navigate("Subscriptions")} theme={theme} />
            <SettingItem icon="tag" label="Mis Gift Cards" onPress={() => navigation.navigate("GiftCards")} theme={theme} />
            <SettingItem icon="users" label="Pedido grupal" onPress={() => navigation.navigate("GroupOrder")} theme={theme} />
            <SettingItem icon="clock" label="Pedidos programados" onPress={() => navigation.navigate("ScheduledOrders")} theme={theme} />
          </>
        )}
        {user?.role === "delivery_driver" && (
          <SettingItem icon="credit-card" label="Cuentas para recibir pagos" value="Bizum · Transferencia" onPress={() => navigation.navigate("PaymentWalletSetup")} theme={theme} />
        )}
      </View>

      {/* Driver Stats */}
      {user?.role === "delivery_driver" && driverStats && (
        <View style={[s.settingsCard, { backgroundColor: theme.card }]}>
          <Text style={[s.cardTitle, { color: theme.text }]}>Estado del Repartidor</Text>
          <View style={s.statsGrid}>
            <View style={[s.statBox, { backgroundColor: theme.bg }]}>
              <Text style={[s.statValue, { color: "#FF9800" }]}>{driverStats.rating > 0 ? (driverStats.rating / 10).toFixed(1) : "—"}</Text>
              <Text style={[s.statLabel, { color: theme.sub }]}>Rating</Text>
            </View>
            <View style={[s.statBox, { backgroundColor: theme.bg }]}>
              <Text style={[s.statValue, { color: PRIMARY }]}>{driverStats.totalDeliveries}</Text>
              <Text style={[s.statLabel, { color: theme.sub }]}>Entregas</Text>
            </View>
            <View style={[s.statBox, { backgroundColor: theme.bg }]}>
              <Feather name={driverStats.verificationStatus === "verified" ? "check-circle" : "clock"} size={24} color={driverStats.verificationStatus === "verified" ? "#4CAF50" : "#F59E0B"} />
              <Text style={[s.statLabel, { color: theme.sub }]}>{driverStats.verificationStatus === "verified" ? "Verificado" : "Pendiente"}</Text>
            </View>
          </View>
          {driverStats.strikes > 0 && (
            <View style={[s.warningBox, { backgroundColor: "#FFF3E0", borderColor: "#FF9800" }]}>
              <Feather name="alert-triangle" size={18} color="#FF9800" />
              <Text style={{ color: "#E65100", marginLeft: 8, flex: 1, fontSize: 13 }}>
                Tienes {driverStats.strikes} strike{driverStats.strikes > 1 ? "s" : ""}. Con 3 strikes tu cuenta puede ser suspendida.
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function BusinessSection({ navigation, theme }: any) {
  return (
    <View>
      <Text style={[s.sectionTitle, { color: theme.text }]}>Mi Negocio</Text>
      <View style={[s.settingsCard, { backgroundColor: theme.card }]}>
        <SettingItem icon="briefcase" label="Mis Negocios" onPress={() => navigation.navigate("MyBusinesses")} theme={theme} />
        <SettingItem icon="clock" label="Horarios de atención" onPress={() => navigation.navigate("BusinessHours")} theme={theme} />
        <SettingItem icon="map-pin" label="Zonas de entrega" onPress={() => navigation.navigate("DeliveryConfig")} theme={theme} />
        <SettingItem icon="settings" label="Configuración del negocio" onPress={() => navigation.navigate("BusinessManage")} theme={theme} />
      </View>
    </View>
  );
}

function PaymentsSection({ navigation, theme }: any) {
  return (
    <View>
      <Text style={[s.sectionTitle, { color: theme.text }]}>Pagos</Text>
      <View style={[s.settingsCard, { backgroundColor: theme.card }]}>
        <SettingItem icon="credit-card" label="Cuentas para recibir pagos" value="Bizum · Transferencia" onPress={() => navigation.navigate("PaymentWalletSetup")} theme={theme} />
        <SettingItem icon="dollar-sign" label="Historial de pagos" onPress={() => navigation.navigate("BusinessFinances")} theme={theme} />
      </View>
    </View>
  );
}

function PreferencesSection({ themeMode, setThemeMode, settings, updateSettings, showToast, theme }: any) {
  const getThemeLabel = (mode: ThemeMode) => {
    switch (mode) {
      case "system": return "Sistema";
      case "light": return "Claro";
      case "dark": return "Oscuro";
      default: return "Sistema";
    }
  };

  return (
    <View>
      <Text style={[s.sectionTitle, { color: theme.text }]}>Preferencias</Text>
      
      <View style={[s.settingsCard, { backgroundColor: theme.card }]}>
        <SettingItem icon="moon" label="Tema" value={getThemeLabel(themeMode)} onPress={() => {}} theme={theme} />
        <View style={s.themeButtons}>
          {(["system", "light", "dark"] as ThemeMode[]).map(mode => (
            <Pressable
              key={mode}
              onPress={() => setThemeMode(mode)}
              style={[s.themeBtn, { backgroundColor: themeMode === mode ? PRIMARY : theme.bg, borderColor: themeMode === mode ? PRIMARY : theme.border }]}
            >
              <Feather name={mode === "system" ? "smartphone" : mode === "light" ? "sun" : "moon"} size={16} color={themeMode === mode ? "#FFF" : theme.sub} />
              <Text style={[s.themeBtnText, { color: themeMode === mode ? "#FFF" : theme.text }]}>
                {mode === "system" ? "Sistema" : mode === "light" ? "Claro" : "Oscuro"}
              </Text>
            </Pressable>
          ))}
        </View>
        
        <SettingItem 
          icon="bell" 
          label="Notificaciones" 
          value={settings.notificationsEnabled ? "Activadas" : "Desactivadas"} 
          onPress={async () => {
            await updateSettings({ notificationsEnabled: !settings.notificationsEnabled });
            showToast(settings.notificationsEnabled ? "Notificaciones desactivadas" : "Notificaciones activadas", "info");
          }} 
          theme={theme} 
        />
        
        <SettingItem icon="globe" label="Idioma" value="Español" onPress={() => {}} theme={theme} />
      </View>
    </View>
  );
}

function MoreSection({ navigation, theme }: any) {
  return (
    <View>
      <Text style={[s.sectionTitle, { color: theme.text }]}>Más</Text>
      
      <View style={[s.settingsCard, { backgroundColor: theme.card }]}>
        <SettingItem icon="share-2" label="Compartir ComeYa" onPress={() => {
          if (navigator.share) {
            navigator.share({
              title: "ComeYa - Delivery Local",
              text: "Descubre ComeYa - Tu delivery local de confianza en Soria.",
              url: "https://comeya.es"
            });
          }
        }} theme={theme} />
        
        <SettingItem icon="help-circle" label="Ayuda y soporte" onPress={() => navigation.navigate("Support")} theme={theme} />
        <SettingItem icon="file-text" label="Términos y condiciones" onPress={() => navigation.navigate("Terms")} theme={theme} />
        <SettingItem icon="shield" label="Política de privacidad" onPress={() => navigation.navigate("Privacy")} theme={theme} />
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
        {value && <Text style={[s.settingValue, { color: theme.sub }]}>{value}</Text>}
      </View>
      <Feather name="chevron-right" size={18} color={theme.sub} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "row" },
  sidebar: { width: 280, borderRightWidth: 1, flexDirection: "column" as any },
  sideHeader: { padding: 24, alignItems: "center", borderBottomWidth: 1 },
  businessHeader: { flexDirection: "row", alignItems: "center", gap: 16, padding: 20, borderRadius: 16, borderWidth: 1, marginBottom: 24 },
  avatarContainer: { position: "relative" },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  editBadge: { position: "absolute", bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#FFF" },
  userName: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  userPhone: { fontSize: 13, marginBottom: 12 },
  badges: { flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "center" },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  roleBadgeText: { fontSize: 11, fontWeight: "700" },
  sideNav: { paddingVertical: 16 },
  navItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 20 },
  navItemActive: { backgroundColor: PRIMARY + "10", borderRightWidth: 3, borderRightColor: PRIMARY },
  navItemText: { fontSize: 14, fontWeight: "600" },
  sideFooter: { borderTopWidth: 1, borderTopColor: "#e0e0e0", padding: 16, paddingBottom: 32 },
  logoutBtn: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 12 },
  logoutBtnText: { fontSize: 14, fontWeight: "600" },
  main: { flex: 1 },
  mainContent: { padding: 32, maxWidth: 800 },
  sectionTitle: { fontSize: 22, fontWeight: "800", marginBottom: 16 },
  settingsCard: { borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 16 },
  settingItem: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12 },
  settingIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  settingContent: { flex: 1 },
  settingLabel: { fontSize: 14, fontWeight: "600" },
  settingValue: { fontSize: 12, marginTop: 2 },
  statsGrid: { flexDirection: "row", gap: 12, marginBottom: 16 },
  statBox: { flex: 1, padding: 16, borderRadius: 12, alignItems: "center" },
  statValue: { fontSize: 24, fontWeight: "900", marginBottom: 4 },
  statLabel: { fontSize: 11 },
  warningBox: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 8 },
  themeButtons: { flexDirection: "row", gap: 8, marginVertical: 12 },
  themeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5 },
  themeBtnText: { fontSize: 12, fontWeight: "600" },
  version: { textAlign: "center", fontSize: 12, marginTop: 20 },
  // Móvil
  mobileNav:     { borderBottomWidth: 1 },
  mobileHeader:  { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: 1 },
  avatarSmall:   { width: 44, height: 44, borderRadius: 22 },
  mobileTabs:    { flexDirection: "row" },
  mobileTab:     { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  mobileTabText: { fontSize: 12, fontWeight: "600" },
});
