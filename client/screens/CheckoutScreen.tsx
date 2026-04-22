import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Constants from "expo-constants";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest } from "@/lib/query-client";
import { useToast } from "@/contexts/ToastContext";
import { calculateDistance, calculateDeliveryFee, estimateDeliveryTime } from "@/utils/distance";
import { useStripePaymentSheet } from "@/hooks/useStripePaymentSheet";

type SubstitutionOption = "refund" | "call" | "substitute";

type PaymentMethod = "stripe_card" | "stripe_bizum" | "paypal" | "binance";

type CheckoutScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Checkout"
>;

export default function CheckoutScreen({ route }: any) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<CheckoutScreenNavigationProp>();
  const { theme } = useTheme();
  const { cart, subtotal: cartSubtotal, clearCart } = useCart();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { presentPaymentSheet } = useStripePaymentSheet();
  
  // Usar subtotal del carrito directamente
  const subtotal = cartSubtotal;

  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dynamicDeliveryFee, setDynamicDeliveryFee] = useState<number | null>(null);
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("stripe_card");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<any>(null);

  // Preferencias de sustitución
  const [globalSubstitution, setGlobalSubstitution] =
    useState<SubstitutionOption>("refund");
  const [itemSubstitutions, setItemSubstitutions] = useState<
    Record<string, SubstitutionOption>
  >({});
  const [showItemSubstitutions, setShowItemSubstitutions] = useState(false);

  // Cupón
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponLoading, setCouponLoading] = useState(false);
  const [addressPickerVisible, setAddressPickerVisible] = useState(false);

  const loadAddresses = React.useCallback(async (preferredId?: string) => {
    if (!user?.id) return;
    try {
      const response = await apiRequest("GET", `/api/users/${user.id}/addresses`);
      const data = await response.json();
      console.log('📍 Addresses loaded:', data.addresses?.length || 0, data.addresses);
      const fetchedAddresses = data.addresses || [];
      setAddresses(fetchedAddresses);
      setSelectedAddress((current: any) => {
        if (preferredId) {
          const preferred = fetchedAddresses.find((a: any) => a.id === preferredId);
          if (preferred) return preferred;
        }
        if (current) {
          const updated = fetchedAddresses.find((a: any) => a.id === current.id);
          if (updated) return updated;
        }
        return (
          fetchedAddresses.find((a: any) => a.isDefault) ||
          fetchedAddresses[0] ||
          null
        );
      });
    } catch (error) {
      console.error('Error loading addresses:', error);
    }
  }, [user?.id]);

  useEffect(() => {
    loadAddresses(route?.params?.selectedAddressId);
  }, [loadAddresses, route?.params?.selectedAddressId]);

  useFocusEffect(
    React.useCallback(() => {
      loadAddresses();
      
      // Manejar selección de método de pago
      if (route?.params?.selectedPaymentMethod) {
        console.log('📱 Setting payment method:', route.params.selectedPaymentMethod);
        setSelectedPaymentMethod(route.params.selectedPaymentMethod);
        setPaymentMethod(route.params.selectedPaymentMethod.provider);
        // Limpiar el parámetro
        navigation.setParams({ selectedPaymentMethod: undefined } as any);
      }
    }, [loadAddresses, route?.params?.selectedPaymentMethod]),
  );

  useEffect(() => {
    if (route?.params?.addressRefreshToken) {
      loadAddresses(route.params.selectedAddressId);
      navigation.setParams({ addressRefreshToken: undefined } as any);
    }
  }, [route?.params?.addressRefreshToken, route?.params?.selectedAddressId, loadAddresses, navigation]);

  useEffect(() => {
    if (cart?.businessId) {
      loadBusiness();
    }
  }, [cart?.businessId]);

  const loadBusiness = async () => {
    try {
      const response = await apiRequest("GET", `/api/businesses/${cart?.businessId}`);
      const data = await response.json();
      setBusiness(data.business);
    } catch (error) {
      console.error("Error loading business:", error);
    }
  };

  const deliveryFee = route?.params?.calculatedDeliveryFee ?? (dynamicDeliveryFee ?? (business?.deliveryFee ? Math.max(business.deliveryFee, 250) / 100 : 2.5));
  
  const [tip, setTip] = useState(0);
  const comeyaCommission = subtotal * 0.15;
  const total = subtotal + comeyaCommission + deliveryFee - couponDiscount + tip;

  // Calcular delivery fee dinámico cuando cambia la dirección
  useEffect(() => {
    if (business && selectedAddress && selectedAddress.latitude && selectedAddress.longitude) {
      calculateFee();
    }
  }, [business, selectedAddress]);

  const calculateFee = async () => {
    if (!business || !selectedAddress) return;
    
    const distance = calculateDistance(
      business.latitude || 41.7636,
      business.longitude || -2.4677,
      selectedAddress.latitude,
      selectedAddress.longitude
    );
    const fee = await calculateDeliveryFee(distance);
    const time = estimateDeliveryTime(distance);
    setDynamicDeliveryFee(fee);
    setEstimatedTime(time);
  };

  const handlePlaceOrder = async () => {
    if (!cart || !user) {
      showToast("Error: Usuario no autenticado", "error");
      return;
    }

    if (!selectedAddress) {
      showToast("Selecciona una dirección de entrega", "error");
      return;
    }

    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const finalItemSubstitutions = showItemSubstitutions ? itemSubstitutions : {};
      const subtotalCents = Math.round(subtotal * 100);
      const commissionCents = Math.round(subtotal * 0.15 * 100);
      const deliveryFeeCents = Math.round(deliveryFee * 100);
      const discountCents = appliedCoupon ? Math.round(couponDiscount * 100) : 0;
      const tipCents = Math.round(tip * 100);
      // El total que valida el servidor NO incluye propina
      const orderTotal = subtotalCents + commissionCents + deliveryFeeCents - discountCents;
      const totalAmount = orderTotal + tipCents;

      const orderResponse = await apiRequest("POST", "/api/orders", {
        businessId: cart.businessId,
        businessName: cart.businessName,
        businessImage: business?.image || business?.profileImage || "",
        items: JSON.stringify(cart.items),
        status: "pending",
        subtotal: subtotalCents,
        productosBase: subtotalCents,
        nemyCommission: commissionCents,
        deliveryFee: deliveryFeeCents,
        total: orderTotal,
        tip: tipCents,
        paymentMethod,
        deliveryAddressId: selectedAddress.id,
        deliveryAddress: `${selectedAddress.street}, ${selectedAddress.city}`,
        deliveryLatitude: selectedAddress.latitude,
        deliveryLongitude: selectedAddress.longitude,
        substitutionPreference: globalSubstitution,
        itemSubstitutionPreferences: Object.keys(finalItemSubstitutions).length > 0 ? JSON.stringify(finalItemSubstitutions) : null,
        couponCode: appliedCoupon ? couponCode.toUpperCase() : null,
        couponDiscount: discountCents || null,
      });

      const order = await orderResponse.json();
      const orderId = order.orderId || order.id;

      // Stripe card/bizum — usar Payment Sheet nativo
      if (paymentMethod === "stripe_card" || paymentMethod === "stripe_bizum") {
        const result = await presentPaymentSheet({
          orderId,
          amount: totalAmount,
          subtotal: subtotalCents,
          deliveryFee: deliveryFeeCents,
          businessId: cart.businessId,
        });

        await clearCart();
        Haptics.notificationAsync(
          result.success
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Error
        );
        setIsLoading(false);

        if (result.success) {
          navigation.reset({
            index: 0,
            routes: [
              { name: "Main" },
              { name: "OrderTracking", params: { orderId } },
            ],
          });
        } else if (result.error !== 'Pago cancelado') {
          showToast(result.error || "Error al procesar el pago", "error");
        }
        return;
      }

      // Otros métodos (Bizum manual, SEPA, PayPal manual) — navegar a subir comprobante
      await clearCart();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsLoading(false);

      navigation.reset({
        index: 0,
        routes: [
          { name: "Main" },
          {
            name: "PaymentProof",
            params: {
              orderId,
              amount: totalAmount,
              paymentMethod,
            },
          },
        ],
      });
    } catch (error: any) {
      console.error("Error placing order:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast("No se pudo procesar tu pedido. Intenta de nuevo.", "error");
      setIsLoading(false);
    }
  };

  if (!cart) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      >
        <ThemedText type="h2">No hay productos en el carrito</ThemedText>
      </View>
    );
  }

  // Helper para obtener el icono y texto de sustitución
  const getSubstitutionInfo = (option: SubstitutionOption) => {
    switch (option) {
      case "refund":
        return {
          icon: "dollar-sign" as const,
          label: "Reembolsar",
          desc: "Te devolvemos el dinero",
        };
      case "call":
        return {
          icon: "phone" as const,
          label: "Llamarme",
          desc: "El negocio te contactará",
        };
      case "substitute":
        return {
          icon: "refresh-cw" as const,
          label: "Sustituir",
          desc: "Producto similar",
        };
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      showToast("Ingresa un código de cupón", "error");
      return;
    }

    setCouponLoading(true);
    try {
      const response = await apiRequest("POST", "/api/coupons/validate", {
        code: couponCode.toUpperCase(),
        userId: user?.id,
        orderTotal: Math.round((subtotal + deliveryFee) * 100),
      });
      const data = await response.json();

      if (data.valid) {
        const discount = data.discountType === "percentage"
          ? ((subtotal + deliveryFee) * data.discount) / 100
          : data.discount / 100;
        
        const maxDiscount = data.coupon.maxDiscountAmount ? data.coupon.maxDiscountAmount / 100 : discount;
        const finalDiscount = Math.min(discount, maxDiscount);

        setAppliedCoupon(data.coupon);
        setCouponDiscount(finalDiscount);
        showToast(`¡Cupón aplicado! Ahorras €${finalDiscount.toFixed(2)}`, "success");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        showToast(data.error || "Cupón inválido", "error");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (error) {
      showToast("Error al validar cupón", "error");
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setCouponCode("");
    Haptics.selectionAsync();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <Modal
        visible={addressPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddressPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setAddressPickerVisible(false)}
          />
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.card,
                paddingBottom: insets.bottom + Spacing.lg,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <ThemedText type="h4">Selecciona una dirección</ThemedText>
              <Pressable onPress={() => setAddressPickerVisible(false)}>
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 380 }}>
              {addresses.map((addr: any) => {
                const isSelected = selectedAddress?.id === addr.id;
                return (
                  <Pressable
                    key={addr.id}
                    onPress={() => {
                      setSelectedAddress(addr);
                      setAddressPickerVisible(false);
                    }}
                    style={[
                      styles.modalAddress,
                      {
                        borderColor: isSelected
                          ? ComeYaColors.primary
                          : theme.border,
                        backgroundColor: theme.backgroundSecondary,
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <ThemedText type="body" style={{ fontWeight: "700" }}>
                        {addr.label}
                      </ThemedText>
                      <ThemedText
                        type="small"
                        style={{ color: theme.textSecondary }}
                      >
                        {addr.street}, {addr.city}
                      </ThemedText>
                    </View>
                    {isSelected ? (
                      <Feather
                        name="check-circle"
                        size={18}
                        color={ComeYaColors.primary}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setAddressPickerVisible(false);
                  navigation.navigate("AddAddress", { fromCheckout: true } as never);
                }}
                style={[
                  styles.manageAddressButton,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <Feather name="plus" size={16} color={ComeYaColors.primary} />
                <ThemedText
                  type="small"
                  style={{ color: ComeYaColors.primary, marginLeft: Spacing.xs }}
                >
                  Nueva dirección
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => {
                  setAddressPickerVisible(false);
                  navigation.navigate("SavedAddresses" as never);
                }}
                style={[
                  styles.manageAddressButton,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <Feather name="map" size={16} color={ComeYaColors.primary} />
                <ThemedText
                  type="small"
                  style={{ color: ComeYaColors.primary, marginLeft: Spacing.xs }}
                >
                  Ver todas
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h2">Confirmar pedido</ThemedText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}
        >
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
              <Feather name="map-pin" size={20} color={ComeYaColors.primary} />
              <ThemedText type="h4" style={styles.sectionTitle}>
                Dirección de entrega
              </ThemedText>
            </View>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setAddressPickerVisible(true);
              }}
              style={styles.inlineLink}
            >
              <Feather name="edit-3" size={16} color={ComeYaColors.primary} />
              <ThemedText type="small" style={{ color: ComeYaColors.primary, marginLeft: Spacing.xs }}>
                Cambiar
              </ThemedText>
            </Pressable>
          </View>
          {addresses.length === 0 ? (
            <Pressable
              onPress={() => navigation.navigate("AddAddress", { fromCheckout: true } as never)}
              style={[
                styles.addressCard,
                {
                  backgroundColor: theme.backgroundSecondary,
                  borderColor: ComeYaColors.primary,
                  borderStyle: "dashed",
                },
              ]}
            >
              <View style={styles.addressContent}>
                <Feather name="plus" size={20} color={ComeYaColors.primary} />
                <ThemedText
                  type="body"
                  style={{ color: ComeYaColors.primary, marginLeft: Spacing.sm }}
                >
                  Agregar dirección
                </ThemedText>
              </View>
            </Pressable>
          ) : (
            addresses.map((addr: any) => (
              <Pressable
                key={addr.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedAddress(addr);
                }}
                style={[
                  styles.addressCard,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    borderColor:
                      selectedAddress?.id === addr.id
                        ? ComeYaColors.primary
                        : "transparent",
                  },
                ]}
                accessibilityLabel={`Dirección ${addr.label}: ${addr.street}, ${addr.city}`}
                accessibilityHint={selectedAddress?.id === addr.id ? 'Dirección seleccionada' : 'Toca para seleccionar esta dirección'}
                accessibilityRole="radio"
                accessibilityState={{ checked: selectedAddress?.id === addr.id }}
              >
                <View style={styles.addressContent}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    {addr.label}
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    {addr.street}, {addr.city}
                  </ThemedText>
                </View>
                {selectedAddress?.id === addr.id ? (
                  <Feather
                    name="check-circle"
                    size={20}
                    color={ComeYaColors.primary}
                  />
                ) : null}
              </Pressable>
            ))
          )}

          {selectedAddress ? (
            <View style={styles.addressActionsRow}>
              <Pressable
                onPress={() => navigation.navigate("AddAddress", { address: selectedAddress, fromCheckout: true } as never)}
                style={[styles.manageAddressButton, { backgroundColor: theme.backgroundSecondary }]}
              >
                <Feather name="edit-2" size={16} color={ComeYaColors.primary} />
                <ThemedText type="small" style={{ color: ComeYaColors.primary, marginLeft: Spacing.xs }}>
                  Editar esta
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => navigation.navigate("SavedAddresses" as never)}
                style={[styles.manageAddressButton, { backgroundColor: theme.backgroundSecondary }]}
              >
                <Feather name="map" size={16} color={ComeYaColors.primary} />
                <ThemedText type="small" style={{ color: ComeYaColors.primary, marginLeft: Spacing.xs }}>
                  Gestionar direcciones
                </ThemedText>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View
          style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}
        >
          <View style={styles.sectionHeader}>
            <Feather name="credit-card" size={20} color={ComeYaColors.primary} />
            <ThemedText type="h4" style={styles.sectionTitle}>
              Método de pago
            </ThemedText>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                navigation.navigate("DigitalPaymentMethod", {
                  orderTotal: total,
                } as any);
              }}
              style={styles.inlineLink}
            >
              <Feather name="edit-3" size={16} color={ComeYaColors.primary} />
              <ThemedText type="small" style={{ color: ComeYaColors.primary, marginLeft: Spacing.xs }}>
                Cambiar
              </ThemedText>
            </Pressable>
          </View>
          
          <Pressable
            style={[
              styles.paymentOption,
              {
                backgroundColor: ComeYaColors.primaryLight,
                borderColor: ComeYaColors.primary,
              },
            ]}
          >
            <View style={styles.paymentContent}>
              <Feather 
                name={paymentMethod === "stripe_card" ? "credit-card" :
                      paymentMethod === "stripe_bizum" ? "smartphone" :
                      paymentMethod === "paypal" ? "dollar-sign" :
                      "zap"} 
                size={24} 
                color={theme.text} 
              />
              <View style={styles.paymentText}>
                <ThemedText type="body" style={{ fontWeight: "600" }}>
                  {selectedPaymentMethod?.displayName ||
                    (paymentMethod === "stripe_card" ? "Tarjeta" :
                     paymentMethod === "stripe_bizum" ? "Bizum" :
                     paymentMethod === "paypal" ? "PayPal" : "Binance Pay")}
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  {selectedPaymentMethod?.instructions || "Pago seguro y automático"}
                </ThemedText>
              </View>
            </View>
            <Feather name="check-circle" size={20} color={ComeYaColors.primary} />
          </Pressable>
        </View>

        {/* Sección de cupón */}
        <View
          style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}
        >
          <View style={styles.sectionHeader}>
            <Feather name="tag" size={20} color={ComeYaColors.primary} />
            <ThemedText type="h4" style={styles.sectionTitle}>
              Cupón de descuento
            </ThemedText>
          </View>
          
          {appliedCoupon ? (
            <View style={[styles.appliedCouponBox, { backgroundColor: ComeYaColors.success + "15", borderColor: ComeYaColors.success }]}>
              <View style={{ flex: 1 }}>
                <ThemedText type="body" style={{ fontWeight: "600", color: ComeYaColors.success }}>
                  {couponCode.toUpperCase()}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4 }}>
                  Ahorras €{couponDiscount.toFixed(2)}
                </ThemedText>
              </View>
              <Pressable onPress={handleRemoveCoupon} style={styles.removeCouponButton}>
                <Feather name="x" size={20} color={ComeYaColors.error} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.couponInputContainer}>
              <TextInput
                style={[styles.couponInput, { color: theme.text, backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
                value={couponCode}
                onChangeText={setCouponCode}
                placeholder="Ingresa tu código"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="characters"
                editable={!couponLoading}
              />
              <Pressable
                onPress={handleApplyCoupon}
                disabled={couponLoading || !couponCode.trim()}
                style={[styles.applyCouponButton, { backgroundColor: couponLoading || !couponCode.trim() ? theme.textSecondary : ComeYaColors.primary }]}
              >
                {couponLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <ThemedText type="body" style={{ color: "#FFF", fontWeight: "600" }}>
                    Aplicar
                  </ThemedText>
                )}
              </Pressable>
            </View>
          )}
        </View>

        {/* Sección de sustituciones */}
        <View
          style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}
        >
          <View style={styles.sectionHeader}>
            <Feather name="refresh-cw" size={20} color={ComeYaColors.primary} />
            <ThemedText type="h4" style={styles.sectionTitle}>
              Si algo no está disponible...
            </ThemedText>
          </View>
          <ThemedText
            type="small"
            style={{ color: theme.textSecondary, marginBottom: Spacing.md }}
          >
            Elige qué hacer si un producto está agotado
          </ThemedText>

          {/* Opciones globales */}
          <View style={styles.substitutionOptions}>
            {(["refund", "call", "substitute"] as SubstitutionOption[]).map(
              (option) => {
                const info = getSubstitutionInfo(option);
                const isSelected = globalSubstitution === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setGlobalSubstitution(option);
                    }}
                    style={[
                      styles.substitutionOption,
                      {
                        backgroundColor: isSelected
                          ? ComeYaColors.primary + "15"
                          : theme.backgroundSecondary,
                        borderColor: isSelected
                          ? ComeYaColors.primary
                          : "transparent",
                      },
                    ]}
                    testID={`option-substitution-${option}`}
                  >
                    <Feather
                      name={info.icon}
                      size={20}
                      color={
                        isSelected ? ComeYaColors.primary : theme.textSecondary
                      }
                    />
                    <ThemedText
                      type="small"
                      style={{
                        color: isSelected ? ComeYaColors.primary : theme.text,
                        marginTop: Spacing.xs,
                        fontWeight: isSelected ? "600" : "400",
                      }}
                    >
                      {info.label}
                    </ThemedText>
                  </Pressable>
                );
              },
            )}
          </View>

          {/* Toggle para preferencias por ítem */}
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setShowItemSubstitutions(!showItemSubstitutions);
            }}
            style={styles.itemSubstitutionToggle}
          >
            <ThemedText type="small" style={{ color: ComeYaColors.primary }}>
              {showItemSubstitutions
                ? "Usar misma opción para todos"
                : "Elegir por producto"}
            </ThemedText>
            <Feather
              name={showItemSubstitutions ? "chevron-up" : "chevron-down"}
              size={16}
              color={ComeYaColors.primary}
            />
          </Pressable>

          {/* Preferencias por ítem */}
          {showItemSubstitutions && cart ? (
            <View style={styles.itemSubstitutionList}>
              {cart.items.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.itemSubstitutionRow,
                    { borderColor: theme.border },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{ flex: 1 }}
                    numberOfLines={1}
                  >
                    {item.product.name}
                  </ThemedText>
                  <View style={styles.itemSubstitutionButtons}>
                    {(
                      ["refund", "call", "substitute"] as SubstitutionOption[]
                    ).map((option) => {
                      const currentOption =
                        itemSubstitutions[item.id] || globalSubstitution;
                      const isSelected = currentOption === option;
                      const info = getSubstitutionInfo(option);
                      return (
                        <Pressable
                          key={option}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setItemSubstitutions({
                              ...itemSubstitutions,
                              [item.id]: option,
                            });
                          }}
                          style={[
                            styles.itemSubstitutionButton,
                            {
                              backgroundColor: isSelected
                                ? ComeYaColors.primary
                                : theme.backgroundSecondary,
                            },
                          ]}
                        >
                          <Feather
                            name={info.icon}
                            size={14}
                            color={isSelected ? "#FFF" : theme.textSecondary}
                          />
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* Propina al repartidor */}
        <View style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}>
          <View style={styles.sectionHeader}>
            <Feather name="heart" size={20} color={ComeYaColors.primary} />
            <ThemedText type="h4" style={styles.sectionTitle}>Propina al repartidor</ThemedText>
          </View>
          <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
            Opcional — 100% va al repartidor
          </ThemedText>
          <View style={{ flexDirection: "row", gap: Spacing.sm }}>
            {[0, 1, 2, 5].map(t => (
              <Pressable
                key={t}
                onPress={() => { setTip(t); Haptics.selectionAsync(); }}
                style={[styles.tipChip, {
                  backgroundColor: tip === t ? ComeYaColors.primary : theme.backgroundSecondary,
                  borderColor: tip === t ? ComeYaColors.primary : theme.border,
                }]}
              >
                <ThemedText type="small" style={{ color: tip === t ? "#FFF" : theme.text, fontWeight: "600" }}>
                  {t === 0 ? "Sin propina" : `€${t}`}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        <View
          style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}
        >
          <View style={styles.sectionHeader}>
            <Feather name="shopping-bag" size={20} color={ComeYaColors.primary} />
            <ThemedText type="h4" style={styles.sectionTitle}>
              Resumen del pedido
            </ThemedText>
          </View>
          <ThemedText
            type="body"
            style={{ color: theme.textSecondary, marginBottom: Spacing.md }}
          >
            {cart.businessName}
          </ThemedText>
          {cart.items.map((item) => (
            <View key={item.id} style={styles.summaryItem}>
              <ThemedText type="small">
                {item.quantity}x {item.product.name}
              </ThemedText>
              <ThemedText type="small">
                €{(item.product.price * item.quantity).toFixed(2)}
              </ThemedText>
            </View>
          ))}
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.backgroundSecondary,
            paddingBottom: insets.bottom + Spacing.lg,
            borderTopColor: theme.border,
          },
        ]}
      >
        <View style={styles.totalRow}>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            Subtotal
          </ThemedText>
          <ThemedText type="body">€{subtotal.toFixed(2)}</ThemedText>
        </View>
        <View style={styles.totalRow}>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            Comisión ComeYa (15%)
          </ThemedText>
          <ThemedText type="body">€{comeyaCommission.toFixed(2)}</ThemedText>
        </View>
        <View style={styles.totalRow}>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            Envío {estimatedTime ? `(~${estimatedTime} min)` : ''}
          </ThemedText>
          <ThemedText type="body">€{deliveryFee.toFixed(2)}</ThemedText>
        </View>
        {couponDiscount > 0 && (
          <View style={styles.totalRow}>
            <ThemedText type="body" style={{ color: ComeYaColors.success }}>
              Cupón ({couponCode})
            </ThemedText>
            <ThemedText type="body" style={{ color: ComeYaColors.success }}>
              -€{couponDiscount.toFixed(2)}
            </ThemedText>
          </View>
        )}
        {tip > 0 && (
          <View style={styles.totalRow}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>Propina</ThemedText>
            <ThemedText type="body">€{tip.toFixed(2)}</ThemedText>
          </View>
        )}
        <View style={[styles.totalRow, styles.grandTotal]}>
          <ThemedText type="h3">Total</ThemedText>
          <ThemedText type="h2" style={{ color: ComeYaColors.primary }}>
            €{total.toFixed(2)}
          </ThemedText>
        </View>
        <Button
          onPress={handlePlaceOrder}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            "Confirmar pedido"
          )}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing["4xl"],
  },
  section: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    marginLeft: Spacing.sm,
  },
  addressCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    marginBottom: Spacing.sm,
  },
  addressContent: {
    flex: 1,
  },
  paymentOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    marginBottom: Spacing.sm,
  },
  paymentContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  paymentText: {
    marginLeft: Spacing.md,
  },
  summaryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.xs,
  },
  inlineLink: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  addressActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  manageAddressButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  footer: {
    padding: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  grandTotal: {
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
    paddingTop: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  // Estilos para sustituciones
  substitutionOptions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  substitutionOption: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
  },
  itemSubstitutionToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  itemSubstitutionList: {
    marginTop: Spacing.sm,
  },
  itemSubstitutionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  itemSubstitutionButtons: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  itemSubstitutionButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  // Estilos para cupón
  couponInputContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  couponInput: {
    flex: 1,
    height: 48,
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    fontWeight: "600",
  },
  applyCouponButton: {
    height: 48,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 100,
  },
  appliedCouponBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
  },
  tipChip: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    alignItems: "center",
  },
  removeCouponButton: {
    padding: Spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  modalAddress: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    marginBottom: Spacing.sm,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
});
