import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  Modal,
  Platform,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

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
import { ComeYaLogo } from "@/components/ComeYaLogo";
import { useResponsive } from "@/hooks/useResponsive";
import { WebLayout } from "@/components/WebLayout";

type SubstitutionOption = "refund" | "call" | "substitute";
type PaymentMethod = "stripe_card" | "stripe_bizum" | "paypal" | "bizum_manual" | "sepa" | "binance";

type CheckoutScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Checkout"
>;

const PRIMARY = "#DC2626";

export default function CheckoutScreen({ route }: any) {
  const navigation = useNavigation<CheckoutScreenNavigationProp>();
  const { theme } = useTheme();
  const { cart, subtotal: cartSubtotal, clearCart } = useCart();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { presentPaymentSheet } = useStripePaymentSheet();
  
  const subtotal = cartSubtotal;
  const orderType: 'delivery' | 'pickup' = route?.params?.orderType === 'pickup' ? 'pickup' : 'delivery';
  const confirmedOrderType = React.useMemo<'delivery' | 'pickup'>(
    () => route?.params?.orderType === 'pickup' ? 'pickup' : 'delivery',
    [route?.params?.orderType]
  );

  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dynamicDeliveryFee, setDynamicDeliveryFee] = useState<number | null>(null);
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("stripe_card");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<any>(null);
  const [globalSubstitution, setGlobalSubstitution] = useState<SubstitutionOption>("refund");
  const [itemSubstitutions, setItemSubstitutions] = useState<Record<string, SubstitutionOption>>({});
  const [showItemSubstitutions, setShowItemSubstitutions] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [subDiscount, setSubDiscount] = useState(0);
  const [subDeliveryFee, setSubDeliveryFee] = useState<number | null>(null);
  const [subBenefits, setSubBenefits] = useState<string[]>([]);
  const [couponLoading, setCouponLoading] = useState(false);
  const [addressPickerVisible, setAddressPickerVisible] = useState(false);
  const [tip, setTip] = useState(0);
  const { isMobile } = useResponsive();

  const deliveryFee = confirmedOrderType === 'pickup' ? 0 : (route?.params?.calculatedDeliveryFee ?? (dynamicDeliveryFee ?? (business?.deliveryFee ? Math.max(business.deliveryFee, 250) / 100 : 2.5)));
  const effectiveDeliveryFee = subDeliveryFee !== null ? subDeliveryFee / 100 : deliveryFee;
  const total = subtotal + effectiveDeliveryFee - couponDiscount - subDiscount + tip;

  // Cargar beneficios de suscripcion cuando cambia el subtotal o deliveryFee
  useEffect(() => {
    if (!user?.id) return;
    const subtotalCents = Math.round(subtotal * 100);
    const deliveryFeeCents = Math.round(deliveryFee * 100);
    apiRequest('GET', `/api/subscriptions/benefits-preview?subtotal=${subtotalCents}&deliveryFee=${deliveryFeeCents}`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.isActive) {
          setSubDiscount(data.discount / 100);
          setSubDeliveryFee(data.deliveryFee);
          setSubBenefits(data.appliedBenefits || []);
        } else {
          setSubDiscount(0);
          setSubDeliveryFee(null);
          setSubBenefits([]);
        }
      }).catch(() => {});
  }, [subtotal, deliveryFee, user?.id]);

  useEffect(() => {
    const loadDefaultPayment = async () => {
      try {
        const res = await apiRequest('GET', '/api/payouts/accounts');
        const data = await res.json();
        if (data.success && data.accounts?.length > 0) {
          const defaultAcc = data.accounts.find((a: any) => a.isDefault) || data.accounts[0];
          if (defaultAcc && !route?.params?.selectedPaymentMethod) {
            const providerMap: Record<string, PaymentMethod> = {
              bizum: 'stripe_bizum',
              tarjeta: 'stripe_card',
              paypal: 'paypal',
            };
            const provider = providerMap[defaultAcc.method];
            if (provider) {
              setPaymentMethod(provider);
              const detail =
                defaultAcc.method === 'bizum'   ? defaultAcc.pagoMovilPhone :
                defaultAcc.method === 'tarjeta' ? `**** ${defaultAcc.zellePhone}` :
                defaultAcc.zelleEmail;
              setSelectedPaymentMethod({
                provider,
                displayName:
                  defaultAcc.method === 'bizum'   ? 'Bizum' :
                  defaultAcc.method === 'tarjeta' ? 'Tarjeta' : 'PayPal',
                instructions: detail || 'Método guardado',
              });
            }
          }
        }
      } catch { /* silencioso */ }
    };
    loadDefaultPayment();
  }, []);

  const loadAddresses = React.useCallback(async (preferredId?: string) => {
    if (!user?.id) return;
    try {
      const response = await apiRequest("GET", `/api/users/${user.id}/addresses`);
      const data = await response.json();
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
      if (route?.params?.selectedPaymentMethod) {
        setSelectedPaymentMethod(route.params.selectedPaymentMethod);
        setPaymentMethod(route.params.selectedPaymentMethod.provider);
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

  const getSubstitutionInfo = (option: SubstitutionOption) => {
    switch (option) {
      case "refund":
        return { icon: "dollar-sign" as const, label: "Reembolsar", desc: "Te devolvemos el dinero" };
      case "call":
        return { icon: "phone" as const, label: "Llamarme", desc: "El negocio te contactará" };
      case "substitute":
        return { icon: "refresh-cw" as const, label: "Sustituir", desc: "Producto similar" };
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
      const baseSubtotalCents = Math.round(subtotalCents / 1.15);
      const commissionCents = subtotalCents - baseSubtotalCents;
      const deliveryFeeCents = Math.round(deliveryFee * 100);
      const discountCents = appliedCoupon ? Math.round(couponDiscount * 100) : 0;
      const tipCents = Math.round(tip * 100);
      const orderTotal = baseSubtotalCents + commissionCents + deliveryFeeCents - discountCents;
      const totalAmount = orderTotal + tipCents;

      const orderResponse = await apiRequest("POST", "/api/orders", {
        businessId: cart.businessId,
        businessName: cart.businessName,
        businessImage: business?.image || business?.profileImage || "",
        items: JSON.stringify(cart.items),
        status: "pending",
        subtotal: subtotalCents,
        productosBase: baseSubtotalCents,
        nemyCommission: commissionCents,
        deliveryFee: deliveryFeeCents,
        total: orderTotal,
        tip: tipCents,
        paymentMethod,
        orderType: confirmedOrderType,
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

      if (paymentMethod === "stripe_card" || paymentMethod === "stripe_bizum") {
        // En web, redirigir a pantalla de pago Stripe
        if (Platform.OS === 'web') {
          console.log('[Checkout→Stripe]', { orderId, totalAmount, subtotalCents, deliveryFeeCents, businessId: cart.businessId });
          navigation.navigate('StripePayment' as never, {
            orderId,
            amount: totalAmount,
            subtotal: subtotalCents,
            deliveryFee: deliveryFeeCents,
            businessId: cart.businessId,
          } as never);
          setIsLoading(false);
          return;
        }
        
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
              paymentMethod: paymentMethod === 'bizum_manual' ? 'bizum'
                           : paymentMethod === 'sepa'         ? 'sepa'
                           : 'paypal',
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
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <ThemedText type="h2">No hay productos en el carrito</ThemedText>
      </View>
    );
  }

  return (
    <>
    <WebLayout>
    <ScrollView style={{ flex: 1, backgroundColor: theme.backgroundRoot }} contentContainerStyle={styles.webContainer}>
      {/* LEFT: Hero Section — oculto en móvil */}
      {!isMobile && <View style={styles.heroSection}>
        <View style={styles.heroContent}>
          {/* Logo */}
          <Pressable onPress={() => navigation.navigate("Main" as never)} style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <ComeYaLogo size={48} />
            </View>
            <ThemedText type="h2" style={styles.logoText}>ComeYa</ThemedText>
          </Pressable>

          {/* Headline */}
          <View style={styles.heroTextContainer}>
            <ThemedText type="h1" style={styles.heroTitle}>
              Confirma tu pedido
            </ThemedText>
            <ThemedText type="body" style={styles.heroSubtitle}>
              Revisa los detalles y completa tu compra de forma segura
            </ThemedText>
          </View>

          {/* Order Summary Card */}
          <View style={styles.heroCard}>
            <View style={styles.heroCardHeader}>
              <Feather name="shopping-bag" size={24} color={PRIMARY} />
              <ThemedText type="h4" style={{ marginLeft: 12 }}>Tu pedido</ThemedText>
            </View>
            <View style={styles.heroCardDivider} />
            <ThemedText type="body" style={{ color: "#6B7280", marginBottom: 16 }}>
              {cart.businessName}
            </ThemedText>
            {cart.items.slice(0, 3).map((item) => (
              <View key={item.id} style={styles.heroOrderItem}>
                <ThemedText type="small" style={{ flex: 1 }}>
                  {item.quantity}x {item.product.name}
                </ThemedText>
                <ThemedText type="small" style={{ fontWeight: "600" }}>
                  €{(item.product.price * item.quantity).toFixed(2)}
                </ThemedText>
              </View>
            ))}
            {cart.items.length > 3 && (
              <ThemedText type="caption" style={{ color: "#6B7280", marginTop: 8 }}>
                +{cart.items.length - 3} productos más
              </ThemedText>
            )}
            <View style={[styles.heroCardDivider, { marginVertical: 16 }]} />
            <View style={styles.heroOrderItem}>
              <ThemedText type="body" style={{ fontWeight: "600" }}>Total</ThemedText>
              <ThemedText type="h4" style={{ color: PRIMARY }}>€{total.toFixed(2)}</ThemedText>
            </View>
          </View>

          {/* Trust Badges */}
          <View style={styles.trustBadges}>
            <View style={styles.trustBadge}>
              <Feather name="shield" size={20} color={PRIMARY} />
              <ThemedText type="caption" style={{ marginLeft: 8, color: "#6B7280" }}>
                Pago seguro
              </ThemedText>
            </View>
            <View style={styles.trustBadge}>
              <Feather name="lock" size={20} color={PRIMARY} />
              <ThemedText type="caption" style={{ marginLeft: 8, color: "#6B7280" }}>
                Datos protegidos
              </ThemedText>
            </View>
          </View>
        </View>
      </View>}

      {/* RIGHT: Form Section */}
      <View style={[styles.formSection, isMobile && styles.formSectionMobile]}>
        <View style={[styles.formCard, { backgroundColor: theme.card }, isMobile && { padding: 20, borderRadius: 16 }]}>
            {/* Address Section */}
            <View style={styles.formSection}>
              <View style={styles.formSectionHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                  <Feather name="map-pin" size={20} color={PRIMARY} />
                  <ThemedText type="h4" style={{ marginLeft: 12 }}>
                    Dirección de entrega
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setAddressPickerVisible(true);
                  }}
                  style={styles.changeButton}
                >
                  <ThemedText type="small" style={{ color: PRIMARY, fontWeight: "600" }}>
                    Cambiar
                  </ThemedText>
                </Pressable>
              </View>

              {selectedAddress ? (
                <View style={[styles.selectedCard, { backgroundColor: theme.backgroundSecondary, borderColor: PRIMARY }]}>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="body" style={{ fontWeight: "600", marginBottom: 4 }}>
                      {selectedAddress.label}
                    </ThemedText>
                    <ThemedText type="small" style={{ color: "#6B7280" }}>
                      {selectedAddress.street}, {selectedAddress.city}
                    </ThemedText>
                  </View>
                  <Feather name="check-circle" size={20} color={PRIMARY} />
                </View>
              ) : (
                <Pressable
                  onPress={() => navigation.navigate("AddAddress", { fromCheckout: true } as never)}
                  style={[styles.addButton, { backgroundColor: theme.backgroundSecondary, borderColor: PRIMARY }]}
                >
                  <Feather name="plus" size={20} color={PRIMARY} />
                  <ThemedText type="body" style={{ color: PRIMARY, marginLeft: 12, fontWeight: "600" }}>
                    Agregar dirección
                  </ThemedText>
                </Pressable>
              )}

              {selectedAddress && (
                <View style={styles.actionButtons}>
                  <Pressable
                    onPress={() => navigation.navigate("AddAddress", { address: selectedAddress, fromCheckout: true } as never)}
                    style={styles.secondaryButton}
                  >
                    <Feather name="edit-2" size={16} color={PRIMARY} />
                    <ThemedText type="small" style={{ color: PRIMARY, marginLeft: 8 }}>
                      Editar esta
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => navigation.navigate("SavedAddresses" as never)}
                    style={styles.secondaryButton}
                  >
                    <Feather name="map" size={16} color={PRIMARY} />
                    <ThemedText type="small" style={{ color: PRIMARY, marginLeft: 8 }}>
                      Gestionar direcciones
                    </ThemedText>
                  </Pressable>
                </View>
              )}
            </View>

            <View style={styles.divider} />

            {/* Payment Method Section */}
            <View style={styles.formSection}>
              <View style={styles.formSectionHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                  <Feather name="credit-card" size={20} color={PRIMARY} />
                  <ThemedText type="h4" style={{ marginLeft: 12 }}>
                    Método de pago
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    navigation.navigate("DigitalPaymentMethod", {
                      orderTotal: total,
                      orderType: confirmedOrderType,
                      calculatedDeliveryFee: Math.round(deliveryFee * 100),
                    } as any);
                  }}
                  style={styles.changeButton}
                >
                  <ThemedText type="small" style={{ color: PRIMARY, fontWeight: "600" }}>
                    Cambiar
                  </ThemedText>
                </Pressable>
              </View>

              <View style={styles.selectedCard}>
                <Feather 
                  name={paymentMethod === "stripe_card" ? "credit-card" :
                        paymentMethod === "stripe_bizum" ? "smartphone" :
                        paymentMethod === "paypal" ? "dollar-sign" : "zap"} 
                  size={24} 
                  color="#1F2937" 
                />
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <ThemedText type="body" style={{ fontWeight: "600", marginBottom: 4 }}>
                    {selectedPaymentMethod?.displayName ||
                      (paymentMethod === "stripe_card" ? "Tarjeta" :
                       paymentMethod === "stripe_bizum" ? "Bizum" :
                       paymentMethod === "paypal" ? "PayPal" : "Binance Pay")}
                  </ThemedText>
                  <ThemedText type="small" style={{ color: "#6B7280" }}>
                    {selectedPaymentMethod?.instructions || "Pago seguro y automático"}
                  </ThemedText>
                </View>
                <Feather name="check-circle" size={20} color={PRIMARY} />
              </View>
            </View>

            <View style={styles.divider} />
            {/* Coupon Section */}
            <View style={styles.formSection}>
              <View style={styles.formSectionHeader}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Feather name="tag" size={20} color={PRIMARY} />
                  <ThemedText type="h4" style={{ marginLeft: 12 }}>
                    Cupón de descuento
                  </ThemedText>
                </View>
              </View>

              {appliedCoupon ? (
                <View style={styles.appliedCoupon}>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="body" style={{ fontWeight: "600", color: "#059669", marginBottom: 4 }}>
                      {couponCode.toUpperCase()}
                    </ThemedText>
                    <ThemedText type="small" style={{ color: "#6B7280" }}>
                      Ahorras €{couponDiscount.toFixed(2)}
                    </ThemedText>
                  </View>
                  <Pressable onPress={handleRemoveCoupon}>
                    <Feather name="x" size={20} color="#DC2626" />
                  </Pressable>
                </View>
              ) : (
                <View style={styles.couponInputRow}>
                  <TextInput
                    style={styles.couponInput}
                    value={couponCode}
                    onChangeText={setCouponCode}
                    placeholder="Ingresa tu código"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="characters"
                    editable={!couponLoading}
                  />
                  <Pressable
                    onPress={handleApplyCoupon}
                    disabled={couponLoading || !couponCode.trim()}
                    style={[styles.applyButton, { opacity: couponLoading || !couponCode.trim() ? 0.5 : 1 }]}
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

            <View style={styles.divider} />

            {/* Substitution Section */}
            <View style={styles.formSection}>
              <View style={styles.formSectionHeader}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Feather name="refresh-cw" size={20} color={PRIMARY} />
                  <ThemedText type="h4" style={{ marginLeft: 12 }}>
                    Si algo no está disponible...
                  </ThemedText>
                </View>
              </View>
              <ThemedText type="small" style={{ color: "#6B7280", marginBottom: 16 }}>
                Elige qué hacer si un producto está agotado
              </ThemedText>

              <View style={styles.substitutionGrid}>
                {(["refund", "call", "substitute"] as SubstitutionOption[]).map((option) => {
                  const info = getSubstitutionInfo(option);
                  const isSelected = globalSubstitution === option;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setGlobalSubstitution(option);
                      }}
                      style={[styles.substitutionCard, isSelected && styles.substitutionCardSelected]}
                    >
                      <Feather
                        name={info.icon}
                        size={24}
                        color={isSelected ? PRIMARY : "#6B7280"}
                      />
                      <ThemedText
                        type="body"
                        style={{
                          color: isSelected ? PRIMARY : "#1F2937",
                          marginTop: 8,
                          fontWeight: isSelected ? "600" : "400",
                        }}
                      >
                        {info.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowItemSubstitutions(!showItemSubstitutions);
                }}
                style={styles.toggleButton}
              >
                <ThemedText type="small" style={{ color: PRIMARY }}>
                  {showItemSubstitutions ? "Usar misma opción para todos" : "Elegir por producto"}
                </ThemedText>
                <Feather
                  name={showItemSubstitutions ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={PRIMARY}
                />
              </Pressable>

              {showItemSubstitutions && cart && (
                <View style={{ marginTop: 16 }}>
                  {cart.items.map((item) => (
                    <View key={item.id} style={styles.itemSubRow}>
                      <ThemedText type="small" style={{ flex: 1 }} numberOfLines={1}>
                        {item.product.name}
                      </ThemedText>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        {(["refund", "call", "substitute"] as SubstitutionOption[]).map((option) => {
                          const currentOption = itemSubstitutions[item.id] || globalSubstitution;
                          const isSelected = currentOption === option;
                          const info = getSubstitutionInfo(option);
                          return (
                            <Pressable
                              key={option}
                              onPress={() => {
                                Haptics.selectionAsync();
                                setItemSubstitutions({ ...itemSubstitutions, [item.id]: option });
                              }}
                              style={[styles.itemSubButton, isSelected && { backgroundColor: PRIMARY }]}
                            >
                              <Feather name={info.icon} size={14} color={isSelected ? "#FFF" : "#6B7280"} />
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.divider} />

            {/* Tip Section */}
            <View style={styles.formSection}>
              <View style={styles.formSectionHeader}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Feather name="heart" size={20} color={PRIMARY} />
                  <ThemedText type="h4" style={{ marginLeft: 12 }}>
                    Propina al repartidor
                  </ThemedText>
                </View>
              </View>
              <ThemedText type="small" style={{ color: "#6B7280", marginBottom: 16 }}>
                Opcional — 100% va al repartidor
              </ThemedText>
              <View style={styles.tipGrid}>
                {[0, 1, 2, 5].map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => {
                      setTip(t);
                      Haptics.selectionAsync();
                    }}
                    style={[styles.tipChip, tip === t && styles.tipChipSelected]}
                  >
                    <ThemedText
                      type="body"
                      style={{
                        color: tip === t ? "#FFF" : "#1F2937",
                        fontWeight: "600",
                      }}
                    >
                      {t === 0 ? "Sin propina" : `€${t}`}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.divider} />
            {/* Final Summary */}
            <View style={styles.formSection}>
              <View style={styles.summaryRow}>
                <ThemedText type="body" style={{ color: "#6B7280" }}>Subtotal</ThemedText>
                <ThemedText type="body">€{subtotal.toFixed(2)}</ThemedText>
              </View>
              {confirmedOrderType === 'delivery' && (
                <View style={styles.summaryRow}>
                  <ThemedText type="body" style={{ color: "#6B7280" }}>
                    Envío {estimatedTime ? `(~${estimatedTime} min)` : ''}
                  </ThemedText>
                  <ThemedText type="body">€{deliveryFee.toFixed(2)}</ThemedText>
                </View>
              )}
              {confirmedOrderType === 'pickup' && (
                <View style={styles.pickupBadge}>
                  <ThemedText type="small" style={{ color: "#059669" }}>
                    🎉 Sin coste de envío al recoger en local
                  </ThemedText>
                </View>
              )}
              {couponDiscount > 0 && (
                <View style={styles.summaryRow}>
                  <ThemedText type="body" style={{ color: "#059669" }}>
                    Cupón ({couponCode})
                  </ThemedText>
                  <ThemedText type="body" style={{ color: "#059669" }}>
                    -€{couponDiscount.toFixed(2)}
                  </ThemedText>
                </View>
              )}
              {tip > 0 && (
                <View style={styles.summaryRow}>
                  <ThemedText type="body" style={{ color: "#6B7280" }}>Propina</ThemedText>
                  <ThemedText type="body">€{tip.toFixed(2)}</ThemedText>
                </View>
              )}
              {subDiscount > 0 && (
                <View style={styles.summaryRow}>
                  <ThemedText type="body" style={{ color: "#7C3AED" }}>⭐ Descuento Premium</ThemedText>
                  <ThemedText type="body" style={{ color: "#7C3AED" }}>-€{subDiscount.toFixed(2)}</ThemedText>
                </View>
              )}
              {subDeliveryFee === 0 && confirmedOrderType === 'delivery' && (
                <View style={styles.summaryRow}>
                  <ThemedText type="body" style={{ color: "#7C3AED" }}>⭐ Envío gratis Premium</ThemedText>
                  <ThemedText type="body" style={{ color: "#7C3AED" }}>€0.00</ThemedText>
                </View>
              )}
                            <View style={[styles.summaryRow, styles.totalRow]}>
                <ThemedText type="h3">Total</ThemedText>
                <ThemedText type="h2" style={{ color: PRIMARY }}>
                  €{total.toFixed(2)}
                </ThemedText>
              </View>
            </View>

            {/* Confirm Button */}
            <Pressable
              onPress={handlePlaceOrder}
              disabled={isLoading}
              style={[styles.confirmButton, isLoading && { opacity: 0.6 }]}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <ThemedText type="h4" style={{ color: "#FFF", fontWeight: "600" }}>
                  Confirmar pedido
                </ThemedText>
              )}
            </Pressable>
        </View>
      </View>
    </ScrollView>
    </WebLayout>

    {/* Address Picker Modal */}
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
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <ThemedText type="h4">Selecciona una dirección</ThemedText>
              <Pressable onPress={() => setAddressPickerVisible(false)}>
                <Feather name="x" size={20} color="#1F2937" />
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
                    style={[styles.modalAddress, isSelected && { borderColor: PRIMARY }]}
                  >
                    <View style={{ flex: 1 }}>
                      <ThemedText type="body" style={{ fontWeight: "600", marginBottom: 4 }}>
                        {addr.label}
                      </ThemedText>
                      <ThemedText type="small" style={{ color: "#6B7280" }}>
                        {addr.street}, {addr.city}
                      </ThemedText>
                    </View>
                    {isSelected && <Feather name="check-circle" size={18} color={PRIMARY} />}
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
                style={styles.modalButton}
              >
                <Feather name="plus" size={16} color={PRIMARY} />
                <ThemedText type="small" style={{ color: PRIMARY, marginLeft: 8 }}>
                  Nueva dirección
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => {
                  setAddressPickerVisible(false);
                  navigation.navigate("SavedAddresses" as never);
                }}
                style={styles.modalButton}
              >
                <Feather name="map" size={16} color={PRIMARY} />
                <ThemedText type="small" style={{ color: PRIMARY, marginLeft: 8 }}>
                  Ver todas
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap" as any,
  },
  // LEFT: Hero Section
  heroSection: {
    flex: 1,
    minWidth: 300,
    maxWidth: 600,
    backgroundColor: PRIMARY,
    padding: 48,
    justifyContent: "center",
  },
  heroContent: {
    maxWidth: 480,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 48,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  logoText: {
    color: "#FFF",
    marginLeft: 16,
    fontSize: 28,
    fontWeight: "700",
  },
  heroTextContainer: {
    marginBottom: 48,
  },
  heroTitle: {
    fontSize: 48,
    fontWeight: "800",
    color: "#FFF",
    marginBottom: 16,
    lineHeight: 56,
  },
  heroSubtitle: {
    fontSize: 18,
    color: "rgba(255,255,255,0.9)",
    lineHeight: 28,
  },
  heroCard: {
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 32,
    marginBottom: 32,
    ...Platform.select({
      web: {
        boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
      },
    }),
  },
  heroCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  heroCardDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginBottom: 16,
  },
  heroOrderItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  trustBadges: {
    flexDirection: "row",
    gap: 24,
  },
  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  // RIGHT: Form Section
  formSection: {
    flex: 1,
    minWidth: 300,
    justifyContent: "center",
    alignItems: "center",
    padding: 48,
  },
  formSectionMobile: {
    padding: 16,
  },
  formScrollView: {
    flex: 1,
    width: "100%",
  },
  formScrollContent: {
    alignItems: "center",
    paddingVertical: 48,
  },
  formCard: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 24,
    padding: 48,
    ...Platform.select({
      web: {
        boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
      },
    }),
  },
  formSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  changeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selectedCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  divider: {
    height: 1,
    marginVertical: 32,
  },
  couponInputRow: {
    flexDirection: "row",
    gap: 12,
  },
  couponInput: {
    flex: 1,
    height: 48,
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    backgroundColor: "#FFF",
  },
  applyButton: {
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 100,
  },
  appliedCoupon: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderWidth: 2,
    borderColor: "#059669",
    borderRadius: 12,
    padding: 16,
  },
  substitutionGrid: {
    flexDirection: "row",
    gap: 12,
  },
  substitutionCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 2,
    borderColor: "transparent",
    borderRadius: 16,
    padding: 20,
  },
  substitutionCardSelected: {
    backgroundColor: PRIMARY + "15",
    borderColor: PRIMARY,
  },
  toggleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 8,
    backgroundColor: PRIMARY + "10",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PRIMARY + "30",
  },
  itemSubRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  itemSubButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
  },
  tipGrid: {
    flexDirection: "row",
    gap: 12,
    ...Platform.select({
      web: {
        display: "flex",
        flexWrap: "nowrap",
      },
    }),
  },
  tipChip: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    maxHeight: 48,
  },
  tipChipSelected: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 16,
    marginTop: 8,
    marginBottom: 24,
  },
  pickupBadge: {
    backgroundColor: "#ECFDF5",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  confirmButton: {
    height: 56,
    backgroundColor: PRIMARY,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      web: {
        boxShadow: "0 4px 12px rgba(220, 38, 38, 0.3)",
      },
    }),
  },
  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    width: "90%",
    maxWidth: 500,
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 32,
    ...Platform.select({
      web: {
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      },
    }),
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  modalAddress: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 2,
    borderColor: "transparent",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
