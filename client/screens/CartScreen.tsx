import React from "react";
import { View, StyleSheet, ScrollView, Pressable, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { formatEuros } from "@/utils/currency";

type CartScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Cart"
>;

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<CartScreenNavigationProp>();
  const { theme } = useTheme();
  const { cart, subtotal, updateQuantity, removeFromCart, clearCart } =
    useCart();
  const { user } = useAuth();
  const [addresses, setAddresses] = React.useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = React.useState<any>(null);
  const [calculatedDeliveryFee, setCalculatedDeliveryFee] = React.useState<
    number | null
  >(null);

  const [businessData, setBusinessData] = React.useState<any>(null);

  React.useEffect(() => {
    if (!cart?.businessId) return;
    const bid = cart.businessId;
    import("@/lib/query-client").then(({ apiRequest }) => {
      apiRequest("GET", `/api/businesses/${bid}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success) setBusinessData(data.business);
        })
        .catch(() => {});
    });
  }, [cart?.businessId]);

  const business = businessData;

  // Cargar direcciones del usuario
  const loadAddresses = React.useCallback(async () => {
    if (!user?.id) return;
    try {
      const { apiRequest } = await import("@/lib/query-client");
      const response = await apiRequest(
        "GET",
        `/api/users/${user.id}/addresses`,
      );
      const data = await response.json();
      if (data.success) {
        setAddresses(data.addresses);
        const defaultAddr =
          data.addresses.find((a: any) => a.isDefault) || data.addresses[0];
        setSelectedAddress(defaultAddr);
      }
    } catch (error) {
      console.error("Error loading addresses:", error);
    }
  }, [user?.id]);

  React.useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  useFocusEffect(
    React.useCallback(() => {
      loadAddresses();
    }, [loadAddresses]),
  );

  // Calcular delivery fee REAL basado en distancia
  React.useEffect(() => {
    const calculateFee = async () => {
      if (
        !selectedAddress ||
        !business ||
        !selectedAddress.latitude ||
        !selectedAddress.longitude ||
        !business.latitude ||
        !business.longitude
      ) {
        setCalculatedDeliveryFee((business?.deliveryFee || 300) / 100);
        return;
      }

      try {
        const { apiRequest } = await import("@/lib/query-client");
        const response = await apiRequest(
          "POST",
          "/api/orders/calculate-delivery",
          {
            businessLat: business.latitude,
            businessLng: business.longitude,
            deliveryLat: selectedAddress.latitude,
            deliveryLng: selectedAddress.longitude,
          },
        );
        const data = await response.json();
        if (data.success) {
          setCalculatedDeliveryFee(data.deliveryFee / 100);
        } else {
          setCalculatedDeliveryFee((business.deliveryFee || 300) / 100);
        }
      } catch (error) {
        console.error("Error calculating delivery fee:", error);
        setCalculatedDeliveryFee((business?.deliveryFee || 300) / 100);
      }
    };
    calculateFee();
  }, [selectedAddress, business]);

  const [orderType, setOrderType] = React.useState<"delivery" | "pickup">(
    "delivery",
  );

  const deliveryFee =
    orderType === "pickup"
      ? 0
      : (calculatedDeliveryFee ??
        (businessData?.deliveryFee ? businessData.deliveryFee / 100 : 3));
  const minimumOrder = business?.minimumOrder || 0;

  // Los precios de los productos YA incluyen la comisión del 15%
  // No aplicar comisión adicional aquí
  const total = subtotal + deliveryFee;
  const canProceed = subtotal >= minimumOrder;

  const handleCheckout = () => {
    if (!canProceed) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    if (business && !business.isOpen) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(
        `${business.name || "El negocio"} está cerrado en este momento.`,
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("Checkout", {
      calculatedDeliveryFee: deliveryFee,
      orderType,
    } as any);
  };

  if (!cart || cart.items.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="h2">Carrito</ThemedText>
          <View style={{ width: 44 }} />
        </View>
        <EmptyState
          image={require("../../assets/images/empty-cart.png")}
          title="Tu carrito está vacío"
          description="Agrega productos de tus restaurantes y mercados favoritos"
          actionLabel="Explorar negocios"
          onAction={() => navigation.goBack()}
        />
      </ThemedView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h2">Carrito</ThemedText>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            clearCart();
          }}
          style={styles.clearButton}
        >
          <Feather name="trash-2" size={20} color={ComeYaColors.error} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.businessCard,
            { backgroundColor: theme.card },
            Shadows.sm,
          ]}
        >
          <ThemedText type="h4">{cart.businessName}</ThemedText>
          {!canProceed ? (
            <Badge
              text={`Mín. ${minimumOrder} € (faltan ${(minimumOrder - subtotal).toFixed(0)} €)`}
              variant="warning"
            />
          ) : null}
        </View>

        {cart.items.map((item) => {
          const itemTotal =
            item.product.isWeightBased && item.unitAmount
              ? item.product.price * item.unitAmount * item.quantity
              : item.product.price * item.quantity;

          return (
            <View
              key={item.id}
              style={[
                styles.cartItem,
                { backgroundColor: theme.card },
                Shadows.sm,
              ]}
            >
              <View style={styles.itemContent}>
                <View style={styles.itemInfo}>
                  <ThemedText type="h4" numberOfLines={2}>
                    {item.product.name}
                  </ThemedText>
                  {item.product.isWeightBased && item.unitAmount ? (
                    <ThemedText
                      type="small"
                      style={{ color: theme.textSecondary }}
                    >
                      {item.unitAmount} {item.product.unit} x {item.quantity}
                    </ThemedText>
                  ) : null}
                  {item.note ? (
                    <View style={styles.noteChip}>
                      <Feather
                        name="file-text"
                        size={12}
                        color={ComeYaColors.primary}
                      />
                      <ThemedText
                        type="caption"
                        style={{ color: ComeYaColors.primary, marginLeft: 4 }}
                      >
                        {item.note}
                      </ThemedText>
                    </View>
                  ) : null}
                  <ThemedText
                    type="h4"
                    style={{
                      color: ComeYaColors.primary,
                      marginTop: Spacing.sm,
                    }}
                  >
                    {formatEuros(itemTotal)}
                  </ThemedText>
                </View>
                <View style={styles.itemActions}>
                  <View style={styles.quantityControls}>
                    <Pressable
                      onPress={() => {
                        Haptics.selectionAsync();
                        updateQuantity(item.id, item.quantity - 1);
                      }}
                      style={[
                        styles.qtyButton,
                        { backgroundColor: theme.backgroundSecondary },
                      ]}
                    >
                      <Feather name="minus" size={16} color={theme.text} />
                    </Pressable>
                    <ThemedText type="body" style={styles.qtyText}>
                      {item.quantity}
                    </ThemedText>
                    <Pressable
                      onPress={() => {
                        Haptics.selectionAsync();
                        updateQuantity(item.id, item.quantity + 1);
                      }}
                      style={[
                        styles.qtyButton,
                        { backgroundColor: theme.backgroundSecondary },
                      ]}
                    >
                      <Feather name="plus" size={16} color={theme.text} />
                    </Pressable>
                  </View>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      removeFromCart(item.id);
                    }}
                    style={styles.deleteButton}
                  >
                    <Feather
                      name="trash-2"
                      size={18}
                      color={ComeYaColors.error}
                    />
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.backgroundRoot,
            paddingBottom: insets.bottom + Spacing.lg,
          },
        ]}
      >
        {/* Selector Delivery / Pickup */}
        <View
          style={[
            styles.orderTypeRow,
            {
              backgroundColor: theme.backgroundSecondary,
              borderRadius: BorderRadius.md,
              marginBottom: Spacing.md,
            },
          ]}
        >
          <Pressable
            onPress={() => {
              setOrderType("delivery");
              Haptics.selectionAsync();
            }}
            style={[
              styles.orderTypeBtn,
              orderType === "delivery" && {
                backgroundColor: ComeYaColors.primary,
                borderRadius: BorderRadius.md,
              },
            ]}
          >
            <Feather
              name="truck"
              size={16}
              color={orderType === "delivery" ? "#fff" : theme.textSecondary}
            />
            <ThemedText
              type="small"
              style={{
                marginLeft: 6,
                color: orderType === "delivery" ? "#fff" : theme.textSecondary,
                fontWeight: "600",
              }}
            >
              Envío a domicilio
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => {
              setOrderType("pickup");
              Haptics.selectionAsync();
            }}
            style={[
              styles.orderTypeBtn,
              orderType === "pickup" && {
                backgroundColor: ComeYaColors.primary,
                borderRadius: BorderRadius.md,
              },
            ]}
          >
            <Feather
              name="shopping-bag"
              size={16}
              color={orderType === "pickup" ? "#fff" : theme.textSecondary}
            />
            <ThemedText
              type="small"
              style={{
                marginLeft: 6,
                color: orderType === "pickup" ? "#fff" : theme.textSecondary,
                fontWeight: "600",
              }}
            >
              Recoger en local
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.summaryRow}>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            Subtotal
          </ThemedText>
          <ThemedText type="body">{formatEuros(subtotal)}</ThemedText>
        </View>
        {orderType === "delivery" && (
          <View style={styles.summaryRow}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Envío
            </ThemedText>
            <ThemedText type="body">{formatEuros(deliveryFee)}</ThemedText>
          </View>
        )}
        {orderType === "pickup" && (
          <View
            style={[
              styles.summaryRow,
              {
                backgroundColor: ComeYaColors.success + "15",
                padding: Spacing.sm,
                borderRadius: BorderRadius.sm,
              },
            ]}
          >
            <ThemedText type="small" style={{ color: ComeYaColors.success }}>
              🎉 Sin coste de envío al recoger en local
            </ThemedText>
          </View>
        )}
        <View style={[styles.summaryRow, styles.totalRow]}>
          <ThemedText type="h3">Total</ThemedText>
          <ThemedText type="h2" style={{ color: ComeYaColors.primary }}>
            {formatEuros(total)}
          </ThemedText>
        </View>
        <Button
          onPress={handleCheckout}
          disabled={!canProceed}
          style={styles.checkoutButton}
        >
          {canProceed ? "Continuar al pago" : `Mínimo ${minimumOrder} €`}
        </Button>
      </View>
    </View>
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
    paddingBottom: Spacing.lg,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  clearButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing["4xl"],
  },
  businessCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  cartItem: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  itemContent: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  itemInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  noteChip: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  itemActions: {
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyText: {
    minWidth: 24,
    textAlign: "center",
    fontWeight: "600",
  },
  deleteButton: {
    marginTop: Spacing.md,
    padding: Spacing.xs,
  },
  footer: {
    padding: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
    paddingTop: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  checkoutButton: {
    width: "100%",
  },
  orderTypeRow: {
    flexDirection: "row",
    padding: 4,
  },
  orderTypeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
});
