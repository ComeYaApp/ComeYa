import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  isAvailable: boolean;
}

interface Business {
  id: string;
  name: string;
  isOpen: boolean;
  products: Product[];
}

function ProductRow({
  product,
  onToggle,
}: {
  product: Product;
  onToggle: (productId: string, isAvailable: boolean) => void;
}) {
  const { theme } = useTheme();

  return (
    <Animated.View entering={FadeInDown.springify()}>
      <View
        style={[styles.productRow, { backgroundColor: theme.card }, Shadows.sm]}
      >
        <Image
          source={{ uri: product.image }}
          style={styles.productImage}
          contentFit="cover"
        />
        <View style={styles.productInfo}>
          <ThemedText
            type="body"
            style={{ fontWeight: "600" }}
            numberOfLines={1}
          >
            {product.name}
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            ${(product.price / 100).toFixed(2)}
          </ThemedText>
        </View>
        <View style={styles.availabilityToggle}>
          <ThemedText
            type="caption"
            style={{
              color: product.isAvailable ? "#4CAF50" : "#F44336",
              marginRight: Spacing.sm,
            }}
          >
            {product.isAvailable ? "Disponible" : "Agotado"}
          </ThemedText>
          <Switch
            value={product.isAvailable}
            onValueChange={(value) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onToggle(product.id, value);
            }}
            trackColor={{ false: "#F44336", true: "#4CAF50" }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>
    </Animated.View>
  );
}

export default function BusinessManageScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"products" | "settings">(
    "products",
  );

  const {
    data: business,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<Business>({
    queryKey: ["/api/business", user?.id, "details"],
    enabled: !!user?.id,
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({
      productId,
      isAvailable,
    }: {
      productId: string;
      isAvailable: boolean;
    }) => {
      await apiRequest("PUT", `/api/admin/products/${productId}`, {
        isAvailable,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business", user?.id] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const toggleBusinessMutation = useMutation({
    mutationFn: async ({
      businessId,
      isOpen,
    }: {
      businessId: string;
      isOpen: boolean;
    }) => {
      await apiRequest("PUT", `/api/admin/businesses/${businessId}`, {
        isOpen,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business", user?.id] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handleToggleProduct = (productId: string, isAvailable: boolean) => {
    updateProductMutation.mutate({ productId, isAvailable });
  };

  const handleToggleBusiness = (isOpen: boolean) => {
    if (business) {
      toggleBusinessMutation.mutate({ businessId: business.id, isOpen });
    }
  };

  const products = business?.products || [];
  const availableProducts = products.filter((p) => p.isAvailable);
  const unavailableProducts = products.filter((p) => !p.isAvailable);

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h2">Gestionar Negocio</ThemedText>
        <View style={{ width: 44 }} />
      </View>

      <View
        style={[
          styles.businessCard,
          { backgroundColor: theme.card },
          Shadows.md,
        ]}
      >
        <View style={styles.businessRow}>
          <View>
            <ThemedText type="h3">{business?.name || "Mi Negocio"}</ThemedText>
            <ThemedText
              type="caption"
              style={{
                color: business?.isOpen ? "#4CAF50" : "#F44336",
                marginTop: 4,
              }}
            >
              {business?.isOpen ? "Abierto" : "Cerrado"}
            </ThemedText>
          </View>
          <Switch
            value={business?.isOpen ?? true}
            onValueChange={handleToggleBusiness}
            trackColor={{ false: "#F44336", true: "#4CAF50" }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      <View style={styles.tabs}>
        <Pressable
          onPress={() => setActiveTab("products")}
          style={[
            styles.tab,
            activeTab === "products" && { backgroundColor: ComeYaColors.primary },
          ]}
        >
          <Feather
            name="package"
            size={16}
            color={activeTab === "products" ? "#FFFFFF" : theme.text}
          />
          <ThemedText
            type="body"
            style={{
              color: activeTab === "products" ? "#FFFFFF" : theme.text,
              marginLeft: Spacing.xs,
            }}
          >
            Productos ({products.length})
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab("settings")}
          style={[
            styles.tab,
            activeTab === "settings" && { backgroundColor: ComeYaColors.primary },
          ]}
        >
          <Feather
            name="settings"
            size={16}
            color={activeTab === "settings" ? "#FFFFFF" : theme.text}
          />
          <ThemedText
            type="body"
            style={{
              color: activeTab === "settings" ? "#FFFFFF" : theme.text,
              marginLeft: Spacing.xs,
            }}
          >
            Ajustes
          </ThemedText>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={ComeYaColors.primary}
          />
        }
      >
        {activeTab === "products" ? (
          <>
            {unavailableProducts.length > 0 ? (
              <>
                <View style={styles.sectionHeader}>
                  <Feather name="x-circle" size={16} color="#F44336" />
                  <ThemedText
                    type="h4"
                    style={{ marginLeft: Spacing.sm, color: "#F44336" }}
                  >
                    Agotados ({unavailableProducts.length})
                  </ThemedText>
                </View>
                {unavailableProducts.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    onToggle={handleToggleProduct}
                  />
                ))}
              </>
            ) : null}

            <View style={styles.sectionHeader}>
              <Feather name="check-circle" size={16} color="#4CAF50" />
              <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
                Disponibles ({availableProducts.length})
              </ThemedText>
            </View>
            {availableProducts.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                onToggle={handleToggleProduct}
              />
            ))}
          </>
        ) : (
          <View
            style={[
              styles.settingsSection,
              { backgroundColor: theme.card },
              Shadows.sm,
            ]}
          >
            <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
              Configuración del negocio
            </ThemedText>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Feather name="clock" size={20} color={theme.textSecondary} />
                <View style={{ marginLeft: Spacing.md }}>
                  <ThemedText type="body">Horario de operación</ThemedText>
                  <ThemedText
                    type="caption"
                    style={{ color: theme.textSecondary }}
                  >
                    Lun - Dom: 8:00 AM - 10:00 PM
                  </ThemedText>
                </View>
              </View>
              <Feather
                name="chevron-right"
                size={20}
                color={theme.textSecondary}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Feather name="map-pin" size={20} color={theme.textSecondary} />
                <View style={{ marginLeft: Spacing.md }}>
                  <ThemedText type="body">Zona de entrega</ThemedText>
                  <ThemedText
                    type="caption"
                    style={{ color: theme.textSecondary }}
                  >
                    Radio de 5 km
                  </ThemedText>
                </View>
              </View>
              <Feather
                name="chevron-right"
                size={20}
                color={theme.textSecondary}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Feather name="truck" size={20} color={theme.textSecondary} />
                <View style={{ marginLeft: Spacing.md }}>
                  <ThemedText type="body">Costo de envío</ThemedText>
                  <ThemedText
                    type="caption"
                    style={{ color: theme.textSecondary }}
                  >
                    $25.00 MXN
                  </ThemedText>
                </View>
              </View>
              <Feather
                name="chevron-right"
                size={20}
                color={theme.textSecondary}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Feather
                  name="shopping-cart"
                  size={20}
                  color={theme.textSecondary}
                />
                <View style={{ marginLeft: Spacing.md }}>
                  <ThemedText type="body">Pedido mínimo</ThemedText>
                  <ThemedText
                    type="caption"
                    style={{ color: theme.textSecondary }}
                  >
                    $50.00 MXN
                  </ThemedText>
                </View>
              </View>
              <Feather
                name="chevron-right"
                size={20}
                color={theme.textSecondary}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  businessCard: {
    marginHorizontal: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  businessRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tabs: {
    flexDirection: "row",
    marginHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  productImage: {
    width: 50,
    height: 50,
    borderRadius: BorderRadius.sm,
  },
  productInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  availabilityToggle: {
    flexDirection: "row",
    alignItems: "center",
  },
  settingsSection: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  settingInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  divider: {
    height: 1,
  },
});
