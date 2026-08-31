import React, { useState, useEffect } from "react";
import {
  View,
  ScrollView,
  Pressable,
  Modal,
  StyleSheet,
  Image,
  SafeAreaView,
  Linking,
  Share,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";
import {
  SettingsItem,
  resolveProfileImageUrl,
  styles as baseStyles,
} from "./BaseProfileScreen";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { ComeYaColors, Spacing, BorderRadius } from "@/constants/theme";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

// Extended styles for customer profile
const styles = StyleSheet.create({
  ...baseStyles,
  profileHeader: {
    alignItems: "center",
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  profileImageContainer: {
    position: "relative",
    marginBottom: Spacing.md,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  profileImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  editImageButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: ComeYaColors.primary,
  },
  subscriptionBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
    backgroundColor: ComeYaColors.primary + "18",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  subscriptionBadgeText: {
    color: ComeYaColors.primary,
    fontWeight: "700",
    marginLeft: 4,
  },
  divider: {
    height: 1,
    marginLeft: Spacing.xl + 40,
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
});

export default function CustomerProfileScreen() {
  const { user, logout } = useAuth();
  const { theme, themeMode, setThemeMode } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [subscription, setSubscription] = useState<any>(null);
  const [profileImageVersion, setProfileImageVersion] = useState(0);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    if (user?.role === "customer") {
      loadSubscription();
    }
  }, [user]);

  const loadSubscription = async () => {
    try {
      const res = await apiRequest("GET", "/api/subscriptions/my-subscription");
      const data = await res.json();
      if (data.subscription) setSubscription(data.subscription);
    } catch {
      /* silencioso */
    }
  };

  const shareApp = async () => {
    let message =
      "Descubre ComeYa - Tu delivery local de confianza. https://app.comeya.es";
    try {
      const res = await apiRequest("GET", "/api/referrals/my-code");
      const data = await res.json();
      if (data.success && data.referralCode) {
        message =
          `Descubre ComeYa - Tu delivery local de confianza. ` +
          `Regístrate con mi código ${data.referralCode} y gana puntos en tu primer pedido: ` +
          `https://app.comeya.es?ref=${data.referralCode}`;
      }
    } catch {
      /* sin código: compartir enlace simple */
    }
    try {
      await Share.share({ message });
    } catch {
      Linking.openURL(
        `whatsapp://send?text=${encodeURIComponent(message)}`,
      ).catch(() => {});
    }
  };

  const renderProfileHeader = () => {
    const img = user?.profileImage || "";
    const version = profileImageVersion || Date.now();
    const baseUrl = resolveProfileImageUrl(img);
    const fullUrl = baseUrl ? `${baseUrl}?v=${version}` : null;

    return (
      <View style={styles.profileHeader}>
        <View style={styles.profileImageContainer}>
          {fullUrl ? (
            <Image source={{ uri: fullUrl }} style={styles.profileImage} />
          ) : (
            <View
              style={[
                styles.profileImagePlaceholder,
                { backgroundColor: theme.card },
              ]}
            >
              <Feather name="user" size={40} color={theme.textSecondary} />
            </View>
          )}
          <Pressable
            style={styles.editImageButton}
            onPress={() => navigation.navigate("EditProfile" as any)}
          >
            <Feather name="edit-2" size={14} color="#fff" />
          </Pressable>
        </View>
        <ThemedText type="h2" style={styles.userName}>
          {user?.name || "Usuario"}
        </ThemedText>
        <ThemedText type="body" style={{ color: theme.textSecondary }}>
          {user?.email}
        </ThemedText>
        {subscription && subscription.status === "active" && (
          <View style={styles.subscriptionBadge}>
            <Feather name="award" size={14} color={ComeYaColors.primary} />
            <ThemedText type="caption" style={styles.subscriptionBadgeText}>
              {subscription.planName || "Premium"} activo
            </ThemedText>
          </View>
        )}
        {subscription && subscription.status === "pending_payment" && (
          <View style={[styles.subscriptionBadge, { backgroundColor: "#F59E0B" + "20" }]}>
            <Feather name="clock" size={14} color="#F59E0B" />
            <ThemedText type="caption" style={[styles.subscriptionBadgeText, { color: "#F59E0B" }]}>
              Pago pendiente
            </ThemedText>
          </View>
        )}
      </View>
    );
  };

  const renderCustomerMenuItems = () => {
    const items: {
      icon: keyof typeof Feather.glyphMap;
      label: string;
      onPress: () => void;
    }[] = [
      {
        icon: "map-pin",
        label: "Direcciones guardadas",
        onPress: () => navigation.navigate("SavedAddresses" as any),
      },
      {
        icon: "credit-card",
        label: "Métodos de pago",
        onPress: () => navigation.navigate("PaymentMethods" as any),
      },
      {
        icon: "gift",
        label: "Mis puntos y recompensas",
        onPress: () => navigation.navigate("Gamification" as any),
      },
      {
        icon: "star",
        label: "Suscripciones",
        onPress: () => navigation.navigate("Subscriptions" as any),
      },
      {
        icon: "tag",
        label: "Mis Gift Cards",
        onPress: () => navigation.navigate("GiftCards" as any),
      },
      {
        icon: "clock",
        label: "Pedidos programados",
        onPress: () => navigation.navigate("ScheduledOrders" as any),
      },
      {
        icon: "calendar",
        label: "Mis reservas",
        onPress: () => navigation.navigate("MyReservations" as any),
      },
    ];

    return (
      <View style={styles.section}>
        {items.map((item, index) => (
          <View key={index}>
            <SettingsItem
              icon={item.icon}
              label={item.label}
              onPress={item.onPress}
            />
            {index < items.length - 1 && (
              <View
                style={[styles.divider, { backgroundColor: theme.divider }]}
              />
            )}
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {renderProfileHeader()}
        {renderCustomerMenuItems()}

        <View style={styles.section}>
          <ThemedText type="caption" style={styles.sectionTitle}>
            PREFERENCIAS
          </ThemedText>
          <SettingsItem
            icon="moon"
            label="Tema"
            onPress={() => setShowThemeModal(true)}
          />
          <SettingsItem
            icon="bell"
            label="Notificaciones"
            onPress={() =>
              navigation.navigate("NotificationPreferences" as any)
            }
          />
        </View>

        {/* Más section */}
        <View style={styles.section}>
          <ThemedText type="caption" style={styles.sectionTitle}>
            Más
          </ThemedText>
          <SettingsItem
            icon="share-2"
            label="Compartir ComeYa"
            onPress={shareApp}
          />
          <SettingsItem
            icon="help-circle"
            label="Ayuda y soporte"
            onPress={() => navigation.navigate("Support" as any)}
          />
          <SettingsItem
            icon="file-text"
            label="Términos y condiciones"
            onPress={() => navigation.navigate("Terms" as any)}
          />
          <SettingsItem
            icon="shield"
            label="Política de privacidad"
            onPress={() => navigation.navigate("Privacy" as any)}
          />
          <SettingsItem
            icon="trash-2"
            label="Eliminar cuenta"
            onPress={() => navigation.navigate("DeleteAccount" as any)}
            danger
          />
          <SettingsItem
            icon="log-out"
            label="Cerrar sesión"
            onPress={() => setShowLogoutModal(true)}
            danger
          />
        </View>
      </ScrollView>

      <Modal visible={showThemeModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setShowThemeModal(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <ThemedText type="h3" style={styles.modalTitle}>
              Seleccionar tema
            </ThemedText>
            {[
              { value: "system", label: "Sistema" },
              { value: "light", label: "Claro" },
              { value: "dark", label: "Oscuro" },
            ].map((option) => (
              <Pressable
                key={option.value}
                style={styles.modalOption}
                onPress={() => {
                  setThemeMode(option.value as "system" | "light" | "dark");
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
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setShowLogoutModal(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
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
    </SafeAreaView>
  );
}
