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
  const [showAddressesModal, setShowAddressesModal] = useState(false);
  const [showPaymentMethodsModal, setShowPaymentMethodsModal] = useState(false);
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [showSubscriptionsModal, setShowSubscriptionsModal] = useState(false);
  const [showGiftCardsModal, setShowGiftCardsModal] = useState(false);
  const [showGroupOrderModal, setShowGroupOrderModal] = useState(false);
  const [showScheduledOrdersModal, setShowScheduledOrdersModal] =
    useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
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
        {subscription && (
          <View style={styles.subscriptionBadge}>
            <ThemedText type="caption" style={styles.subscriptionBadgeText}>
              {subscription.planName || "Premium"} activo
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
        onPress: () => navigation.navigate("DigitalPaymentMethod" as any),
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
        icon: "users",
        label: "Pedido grupal",
        onPress: () => navigation.navigate("GroupOrder" as any),
      },
      {
        icon: "clock",
        label: "Pedidos programados",
        onPress: () => navigation.navigate("ScheduledOrders" as any),
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
            onPress={() => setShowNotificationsModal(true)}
          />
          <SettingsItem
            icon="globe"
            label="Idioma"
            onPress={() => setShowLanguageModal(true)}
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
            onPress={() => {
              const message = encodeURIComponent(
                "Descubre ComeYa - Tu delivery local de confianza. https://app.comeya.es",
              );
              Linking.openURL(`whatsapp://send?text=${message}`).catch(
                () => {},
              );
            }}
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
            icon="log-out"
            label="Cerrar sesión"
            onPress={() => setShowLogoutModal(true)}
            danger
          />
        </View>
      </ScrollView>

      <Modal visible={showAddressesModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setShowAddressesModal(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Feather name="map-pin" size={40} color={ComeYaColors.primary} />
            <ThemedText type="h3" style={styles.modalTitle}>
              Direcciones guardadas
            </ThemedText>
            <ThemedText type="body" style={styles.modalMessage}>
              Funcióncoming soon...
            </ThemedText>
            <Pressable
              style={[
                styles.modalButtonFull,
                { backgroundColor: ComeYaColors.primary },
              ]}
              onPress={() => setShowAddressesModal(false)}
            >
              <ThemedText type="body" style={{ color: "#fff" }}>
                Entendido
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showPaymentMethodsModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setShowPaymentMethodsModal(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Feather
              name="credit-card"
              size={40}
              color={ComeYaColors.primary}
            />
            <ThemedText type="h3" style={styles.modalTitle}>
              Métodos de pago
            </ThemedText>
            <ThemedText type="body" style={styles.modalMessage}>
              Funcióncoming soon...
            </ThemedText>
            <Pressable
              style={[
                styles.modalButtonFull,
                { backgroundColor: ComeYaColors.primary },
              ]}
              onPress={() => setShowPaymentMethodsModal(false)}
            >
              <ThemedText type="body" style={{ color: "#fff" }}>
                Entendido
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showPointsModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setShowPointsModal(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Feather name="gift" size={40} color={ComeYaColors.primary} />
            <ThemedText type="h3" style={styles.modalTitle}>
              Mis puntos y recompensas
            </ThemedText>
            <ThemedText type="body" style={styles.modalMessage}>
              Funcióncoming soon...
            </ThemedText>
            <Pressable
              style={[
                styles.modalButtonFull,
                { backgroundColor: ComeYaColors.primary },
              ]}
              onPress={() => setShowPointsModal(false)}
            >
              <ThemedText type="body" style={{ color: "#fff" }}>
                Entendido
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showSubscriptionsModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setShowSubscriptionsModal(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Feather name="star" size={40} color={ComeYaColors.primary} />
            <ThemedText type="h3" style={styles.modalTitle}>
              Suscripciones
            </ThemedText>
            <ThemedText type="body" style={styles.modalMessage}>
              Funcióncoming soon...
            </ThemedText>
            <Pressable
              style={[
                styles.modalButtonFull,
                { backgroundColor: ComeYaColors.primary },
              ]}
              onPress={() => setShowSubscriptionsModal(false)}
            >
              <ThemedText type="body" style={{ color: "#fff" }}>
                Entendido
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showGiftCardsModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setShowGiftCardsModal(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Feather name="tag" size={40} color={ComeYaColors.primary} />
            <ThemedText type="h3" style={styles.modalTitle}>
              Mis Gift Cards
            </ThemedText>
            <ThemedText type="body" style={styles.modalMessage}>
              Funcióncoming soon...
            </ThemedText>
            <Pressable
              style={[
                styles.modalButtonFull,
                { backgroundColor: ComeYaColors.primary },
              ]}
              onPress={() => setShowGiftCardsModal(false)}
            >
              <ThemedText type="body" style={{ color: "#fff" }}>
                Entendido
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showGroupOrderModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setShowGroupOrderModal(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Feather name="users" size={40} color={ComeYaColors.primary} />
            <ThemedText type="h3" style={styles.modalTitle}>
              Pedido grupal
            </ThemedText>
            <ThemedText type="body" style={styles.modalMessage}>
              Funcióncoming soon...
            </ThemedText>
            <Pressable
              style={[
                styles.modalButtonFull,
                { backgroundColor: ComeYaColors.primary },
              ]}
              onPress={() => setShowGroupOrderModal(false)}
            >
              <ThemedText type="body" style={{ color: "#fff" }}>
                Entendido
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showScheduledOrdersModal}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setShowScheduledOrdersModal(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Feather name="clock" size={40} color={ComeYaColors.primary} />
            <ThemedText type="h3" style={styles.modalTitle}>
              Pedidos programados
            </ThemedText>
            <ThemedText type="body" style={styles.modalMessage}>
              Funcióncoming soon...
            </ThemedText>
            <Pressable
              style={[
                styles.modalButtonFull,
                { backgroundColor: ComeYaColors.primary },
              ]}
              onPress={() => setShowScheduledOrdersModal(false)}
            >
              <ThemedText type="body" style={{ color: "#fff" }}>
                Entendido
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

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

      <Modal visible={showNotificationsModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setShowNotificationsModal(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Feather name="bell" size={40} color={ComeYaColors.primary} />
            <ThemedText type="h3" style={styles.modalTitle}>
              Notificaciones
            </ThemedText>
            <ThemedText type="body" style={styles.modalMessage}>
              Función coming soon...
            </ThemedText>
            <Pressable
              style={[
                styles.modalButtonFull,
                { backgroundColor: ComeYaColors.primary },
              ]}
              onPress={() => setShowNotificationsModal(false)}
            >
              <ThemedText type="body" style={{ color: "#fff" }}>
                Entendido
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showLanguageModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setShowLanguageModal(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Feather name="globe" size={40} color={ComeYaColors.primary} />
            <ThemedText type="h3" style={styles.modalTitle}>
              Idioma
            </ThemedText>
            <ThemedText type="body" style={styles.modalMessage}>
              Función coming soon...
            </ThemedText>
            <Pressable
              style={[
                styles.modalButtonFull,
                { backgroundColor: ComeYaColors.primary },
              ]}
              onPress={() => setShowLanguageModal(false)}
            >
              <ThemedText type="body" style={{ color: "#fff" }}>
                Entendido
              </ThemedText>
            </Pressable>
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
