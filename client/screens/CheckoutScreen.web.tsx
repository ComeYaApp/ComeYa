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
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest } from "@/lib/query-client";
import { useToast } from "@/contexts/ToastContext";
import {
  calculateDistance,
  calculateDeliveryFee,
  estimateDeliveryTime,
} from "@/utils/distance";
import { useStripePaymentSheet } from "@/hooks/useStripePaymentSheet";
import { useResponsive } from "@/hooks/useResponsive";
import { WebLayout } from "@/components/WebLayout";

type SubstitutionOption = "refund" | "call" | "substitute";
type PaymentMethod =
  | "stripe_card"
  | "stripe_bizum"
  | "paypal"
  | "bizum_manual"
  | "binance";

type CheckoutScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Checkout"
>;

const PRIMARY = "#E60000";

export default function CheckoutScreen({ route }: any) {
  const navigation = useNavigation<CheckoutScreenNavigationProp>();
  const { theme } = useTheme();
  const { cart, subtotal: cartSubtotal, clearCart } = useCart();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { presentPaymentSheet } = useStripePaymentSheet();

  const subtotal = cartSubtotal;
  const [orderTypeLocal, setOrderTypeLocal] = useState<"delivery" | "pickup">(
    route?.params?.orderType === "pickup" ? "pickup" : "delivery",
  );

  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dynamicDeliveryFee, setDynamicDeliveryFee] = useState<number | null>(
    null,
  );
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("stripe_card");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<any>(null);
  const [globalSubstitution, setGlobalSubstitution] =
    useState<SubstitutionOption>("refund");
  const [itemSubstitutions, setItemSubstitutions] = useState<
    Record<string, SubstitutionOption>
  >({});
  const [showItemSubstitutions, setShowItemSubstitutions] = useState(false);
  // Tarifa cotizada por el servidor (misma fórmula que el backend)
  const [quotedDeliveryFee, setQuotedDeliveryFee] = useState<number | null>(
    null,
  );
  // Sustituto concreto por producto: originalId → substituteId (igual que nativo)
  const [showSubstitutePicker, setShowSubstitutePicker] = useState<
    string | null
  >(null);
  const [substituteProductIds, setSubstituteProductIds] = useState<
    Record<string, string>
  >({});
  const [businessProducts, setBusinessProducts] = useState<any[]>([]);
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

  // Cargar productos del negocio al abrir el selector de sustituto
  useEffect(() => {
    if (
      showSubstitutePicker === null ||
      businessProducts.length > 0 ||
      !cart?.businessId
    )
      return;
    apiRequest("GET", `/api/businesses/${cart.businessId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.business?.products)) {
          setBusinessProducts(
            data.business.products.map((p: any) => ({
              id: p.id,
              name: p.name,
              image: p.image || "",
              price: p.price,
              available:
                p.isAvailable === true ||
                p.isAvailable === 1 ||
                p.is_available === true ||
                p.is_available === 1,
            })),
          );
        }
      })
      .catch(() => {});
  }, [showSubstitutePicker, businessProducts.length, cart?.businessId]);

  const substituteName = (id: string): string | null => {
    const p = businessProducts.find((x) => x.id === id);
    return p?.name ?? null;
  };

  // Siempre usar el precio que calculó el carrito, o el deliveryFee del negocio
  const deliveryFee =
    orderTypeLocal === "pickup"
      ? 0
      : route?.params?.calculatedDeliveryFee != null
        ? route.params.calculatedDeliveryFee
        : (business as any)?.delivery_fee != null
          ? Math.max(Number((business as any).delivery_fee), 250) / 100
          : 2.5;
  // El TOTAL solo se pinta cuando la tarifa y el descuento Premium están
  // resueltos: antes se mostraba 2,50 € fijo y cambiaba un segundo después
  // (el parpadeo reportado por el cliente).
  const [subPreviewDone, setSubPreviewDone] = useState(false);
  const feeResolved =
    orderTypeLocal === "pickup" || quotedDeliveryFee != null;
  const total =
    subtotal + deliveryFee - couponDiscount - subDiscount + tip;

  // Recotizar la tarifa con la MISMA fórmula del servidor cuando cambia la
  // dirección o el negocio: el total mostrado coincide con el del backend
  // (fin de los importes que cambiaban solos entre pantallas).
  useEffect(() => {
    if (orderTypeLocal === "pickup" || !cart?.businessId) return;
    const biz = business as any;
    const addr = selectedAddress as any;
    const bizLat = Number(biz?.latitude);
    const bizLng = Number(biz?.longitude);
    const addrLat = Number(addr?.latitude);
    const addrLng = Number(addr?.longitude);
    if (
      !Number.isFinite(bizLat) ||
      !Number.isFinite(bizLng) ||
      !Number.isFinite(addrLat) ||
      !Number.isFinite(addrLng)
    ) {
      // Sin coordenadas: resolvemos con la tarifa base del negocio para no
      // dejar el checkout bloqueado
      setQuotedDeliveryFee(
        (business as any)?.delivery_fee != null
          ? Number((business as any).delivery_fee) / 100
          : 2.5,
      );
      return;
    }
    apiRequest("POST", "/api/orders/calculate-delivery", {
      businessLat: bizLat,
      businessLng: bizLng,
      deliveryLat: addrLat,
      deliveryLng: addrLng,
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Number.isFinite(Number(d.deliveryFee))) {
          setQuotedDeliveryFee(Number(d.deliveryFee) / 100);
        }
      })
      .catch(() => {
        setQuotedDeliveryFee(
          (business as any)?.delivery_fee != null
            ? Number((business as any).delivery_fee) / 100
            : 2.5,
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAddress?.id, cart?.businessId, orderTypeLocal, business?.id]);

  // Tarifa efectiva: la cotizada del servidor (si existe) manda
  const effectiveDeliveryFee =
    quotedDeliveryFee != null ? quotedDeliveryFee : deliveryFee;
  const totalShown =
    subtotal + effectiveDeliveryFee - couponDiscount - subDiscount + tip;

  // Cargar beneficios de suscripcion cuando cambia el subtotal o deliveryFee
  useEffect(() => {
    if (!user?.id) {
      setSubPreviewDone(true);
      return;
    }
    const subtotalCents = Math.round(subtotal * 100);
    const deliveryFeeCents = Math.round(deliveryFee * 100);
    apiRequest(
      "GET",
      `/api/subscriptions/benefits-preview?subtotal=${subtotalCents}&deliveryFee=${deliveryFeeCents}`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.isActive) {
          setSubDiscount(data.discount / 100);
          setSubDeliveryFee(data.deliveryFee);
          setSubBenefits(data.appliedBenefits || []);
        } else {
          setSubDiscount(0);
          setSubDeliveryFee(null);
          setSubBenefits([]);
        }
        setSubPreviewDone(true);
      })
      .catch(() => setSubPreviewDone(true));
  }, [subtotal, deliveryFee, user?.id]);

  useEffect(() => {
    const loadDefaultPayment = async () => {
      try {
        const res = await apiRequest("GET", "/api/payouts/accounts");
        const data = await res.json();
        if (data.success && data.accounts?.length > 0) {
          const defaultAcc =
            data.accounts.find((a: any) => a.isDefault) || data.accounts[0];
          if (defaultAcc && !route?.params?.selectedPaymentMethod) {
            const providerMap: Record<string, PaymentMethod> = {
              bizum: "stripe_bizum",
              tarjeta: "stripe_card",
              paypal: "paypal",
            };
            const provider = providerMap[defaultAcc.method];
            if (provider) {
              setPaymentMethod(provider);
              const detail =
                defaultAcc.method === "bizum"
                  ? defaultAcc.pagoMovilPhone
                  : defaultAcc.method === "tarjeta"
                    ? `**** ${defaultAcc.zellePhone}`
                    : defaultAcc.zelleEmail;
              setSelectedPaymentMethod({
                provider,
                displayName:
                  defaultAcc.method === "bizum"
                    ? "Bizum"
                    : defaultAcc.method === "tarjeta"
                      ? "Tarjeta"
                      : "PayPal",
                instructions: detail || "Método guardado",
              });
            }
          }
        }
      } catch {
        /* silencioso */
      }
    };
    loadDefaultPayment();
  }, []);

  const loadAddresses = React.useCallback(
    async (preferredId?: string) => {
      if (!user?.id) return;
      try {
        const response = await apiRequest(
          "GET",
          `/api/users/${user.id}/addresses`,
        );
        const data = await response.json();
        const fetchedAddresses = data.addresses || [];
        setAddresses(fetchedAddresses);
        setSelectedAddress((current: any) => {
          if (preferredId) {
            const preferred = fetchedAddresses.find(
              (a: any) => a.id === preferredId,
            );
            if (preferred) return preferred;
          }
          if (current) {
            const updated = fetchedAddresses.find(
              (a: any) => a.id === current.id,
            );
            if (updated) return updated;
          }
          return (
            fetchedAddresses.find((a: any) => a.isDefault) ||
            fetchedAddresses[0] ||
            null
          );
        });
      } catch (error) {
        console.error("Error loading addresses:", error);
      }
    },
    [user?.id],
  );

  useEffect(() => {
    loadAddresses(route?.params?.selectedAddressId);
  }, [loadAddresses, route?.params?.selectedAddressId]);

  useFocusEffect(
    React.useCallback(() => {
      loadAddresses(route?.params?.selectedAddressId);
      if (route?.params?.selectedPaymentMethod) {
        setSelectedPaymentMethod(route.params.selectedPaymentMethod);
        setPaymentMethod(route.params.selectedPaymentMethod.provider);
        navigation.setParams({ selectedPaymentMethod: undefined } as any);
      }
    }, [loadAddresses, route?.params?.selectedPaymentMethod, route?.params?.selectedAddressId]),
  );

  useEffect(() => {
    if (route?.params?.addressRefreshToken) {
      loadAddresses(route.params.selectedAddressId);
      navigation.setParams({ addressRefreshToken: undefined } as any);
    }
  }, [
    route?.params?.addressRefreshToken,
    route?.params?.selectedAddressId,
    loadAddresses,
    navigation,
  ]);

  useEffect(() => {
    if (cart?.businessId) {
      loadBusiness();
    }
  }, [cart?.businessId]);

  const loadBusiness = async () => {
    try {
      const response = await apiRequest(
        "GET",
        `/api/businesses/${cart?.businessId}`,
      );
      const data = await response.json();
      setBusiness(data.business);
    } catch (error) {
      console.error("Error loading business:", error);
    }
  };

  // Solo calcular tiempo estimado, NO cambiar el delivery fee
  useEffect(() => {
    if (
      business &&
      selectedAddress &&
      selectedAddress.latitude &&
      selectedAddress.longitude &&
      orderTypeLocal === "delivery"
    ) {
      const distance = calculateDistance(
        business.latitude || 41.7636,
        business.longitude || -2.4677,
        selectedAddress.latitude,
        selectedAddress.longitude,
      );
      const time = estimateDeliveryTime(distance);
      setEstimatedTime(time);
    }
  }, [business, selectedAddress, orderTypeLocal]);

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
        const discount =
          data.discountType === "percentage"
            ? ((subtotal + deliveryFee) * data.discount) / 100
            : data.discount / 100;
        const maxDiscount = data.coupon.maxDiscountAmount
          ? data.coupon.maxDiscountAmount / 100
          : discount;
        const finalDiscount = Math.min(discount, maxDiscount);
        setAppliedCoupon(data.coupon);
        setCouponDiscount(finalDiscount);
        showToast(
          `¡Cupón aplicado! Ahorras ${finalDiscount.toFixed(2)} €`,
          "success",
        );
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
    if (orderTypeLocal === "delivery" && !selectedAddress) {
      showToast("Selecciona una dirección de entrega", "error");
      return;
    }
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const finalItemSubstitutions = showItemSubstitutions
        ? itemSubstitutions
        : {};
      const subtotalCents = Math.round(subtotal * 100);
      const baseSubtotalCents = Math.round(subtotalCents / 1.15);
      const commissionCents = subtotalCents - baseSubtotalCents;
      const deliveryFeeCents = Math.round(effectiveDeliveryFee * 100);
      const discountCents = appliedCoupon
        ? Math.round(couponDiscount * 100)
        : 0;
      const tipCents = Math.round(tip * 100);
      const orderTotal =
        baseSubtotalCents + commissionCents + deliveryFeeCents - discountCents;
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
        orderType: orderTypeLocal,
        deliveryAddressId: selectedAddress?.id,
        deliveryAddress: selectedAddress
          ? `${selectedAddress.street}, ${selectedAddress.city}`
          : "Recoger en local",
        deliveryLatitude: selectedAddress?.latitude,
        deliveryLongitude: selectedAddress?.longitude,
        substitutionPreference: globalSubstitution,
        itemSubstitutionPreferences:
          Object.keys(finalItemSubstitutions).length > 0
            ? JSON.stringify(finalItemSubstitutions)
            : null,
        substituteProductIds:
          Object.keys(substituteProductIds).length > 0
            ? JSON.stringify(substituteProductIds)
            : null,
        couponCode: appliedCoupon ? couponCode.toUpperCase() : null,
        couponDiscount: discountCents || null,
      });

      const order = await orderResponse.json();
      const orderId = order.orderId || order.id;

      if (paymentMethod === "stripe_card" || paymentMethod === "stripe_bizum") {
        if (Platform.OS === "web") {
          navigation.navigate(
            "StripePayment" as any,
            {
              orderId,
              amount: totalAmount,
              subtotal: subtotalCents,
              deliveryFee: deliveryFeeCents,
              businessId: cart.businessId,
            } as any,
          );
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
        Haptics.notificationAsync(
          result.success
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Error,
        );
        setIsLoading(false);
        if (result.success) {
          // El carrito SOLO se vacía cuando el pago se completó
          await clearCart();
          navigation.reset({
            index: 0,
            routes: [
              { name: "Main" },
              { name: "OrderTracking", params: { orderId } },
            ],
          });
        } else if (result.error === "Pago cancelado") {
          // Canceló el pago: carrito intacto + cancelar el pedido huérfano
          apiRequest("POST", `/api/orders/${orderId}/cancel-regret`, {})
            .then(() => {})
            .catch(() => {});
          showToast("Pago cancelado — tu carrito sigue intacto", "info");
        } else {
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
              paymentMethod:
                paymentMethod === "bizum_manual" ? "bizum" : "paypal",
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

  const { isDark } = useTheme();
  const bg = isDark ? "#111" : "#f7f7f7";

  if (!cart) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: bg,
            paddingTop: Spacing.xl,
            alignItems: "center",
            justifyContent: "center",
          },
        ]}
      >
        <ThemedText type="h2">No hay productos en el carrito</ThemedText>
      </View>
    );
  }

  return (
    <>
      <WebLayout>
        <ScrollView
          style={{ flex: 1, backgroundColor: bg }}
          contentContainerStyle={styles.pageContent}
        >
          {/* Header */}
          <View style={[styles.pageHeader, { borderBottomColor: isDark ? "#333" : "#e8e8e8" }]}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
            >
              <Feather
                name="arrow-left"
                size={20}
                color={isDark ? "#fff" : "#1a1a1a"}
              />
            </Pressable>
            <ThemedText type="h3">Confirmar pedido</ThemedText>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.centerWrap}>
            <View style={[styles.formCard, { backgroundColor: theme.card }]}>
              {/* Order Type Selector */}
              <View style={styles.section}>
                <View style={styles.formSectionHeader}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Feather name="truck" size={20} color={PRIMARY} />
                    <ThemedText type="h4" style={{ marginLeft: 12 }}>
                      Tipo de pedido
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.orderTypeRow}>
                  <Pressable
                    onPress={() => setOrderTypeLocal("delivery")}
                    style={[
                      styles.orderTypeBtn,
                      orderTypeLocal === "delivery" && styles.orderTypeBtnActive,
                    ]}
                  >
                    <Feather
                      name="truck"
                      size={16}
                      color={orderTypeLocal === "delivery" ? "#fff" : "#6B7280"}
                    />
                    <ThemedText
                      type="body"
                      style={{
                        color: orderTypeLocal === "delivery" ? "#fff" : "#1F2937",
                        fontWeight: "600",
                        marginLeft: 8,
                      }}
                    >
                      Envío a domicilio
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => setOrderTypeLocal("pickup")}
                    style={[
                      styles.orderTypeBtn,
                      orderTypeLocal === "pickup" && styles.orderTypeBtnActive,
                    ]}
                  >
                    <Feather
                      name="shopping-bag"
                      size={16}
                      color={orderTypeLocal === "pickup" ? "#fff" : "#6B7280"}
                    />
                    <ThemedText
                      type="body"
                      style={{
                        color: orderTypeLocal === "pickup" ? "#fff" : "#1F2937",
                        fontWeight: "600",
                        marginLeft: 8,
                      }}
                    >
                      Recoger en local
                    </ThemedText>
                  </Pressable>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Address Section - only for delivery */}
              {orderTypeLocal === "delivery" && (
                <>
                  <View style={styles.section}>
                    <View style={styles.formSectionHeader}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          flex: 1,
                        }}
                      >
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
                        <ThemedText
                          type="small"
                          style={{ color: PRIMARY, fontWeight: "600" }}
                        >
                          Cambiar
                        </ThemedText>
                      </Pressable>
                    </View>

                    {selectedAddress ? (
                      <View
                        style={[
                          styles.selectedCard,
                          {
                            backgroundColor: theme.backgroundSecondary,
                            borderColor: PRIMARY,
                          },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <ThemedText
                            type="body"
                            style={{ fontWeight: "600", marginBottom: 4 }}
                          >
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
                        onPress={() =>
                          navigation.navigate("AddAddress", {
                            fromCheckout: true,
                          } as never)
                        }
                        style={[
                          styles.addButton,
                          {
                            backgroundColor: theme.backgroundSecondary,
                            borderColor: PRIMARY,
                          },
                        ]}
                      >
                        <Feather name="plus" size={20} color={PRIMARY} />
                        <ThemedText
                          type="body"
                          style={{
                            color: PRIMARY,
                            marginLeft: 12,
                            fontWeight: "600",
                          }}
                        >
                          Agregar dirección
                        </ThemedText>
                      </Pressable>
                    )}

                    {selectedAddress && (
                      <View style={styles.actionButtons}>
                        <Pressable
                          onPress={() =>
                            navigation.navigate("AddAddress", {
                              address: selectedAddress,
                              fromCheckout: true,
                            } as never)
                          }
                          style={styles.secondaryButton}
                        >
                          <Feather name="edit-2" size={16} color={PRIMARY} />
                          <ThemedText
                            type="small"
                            style={{ color: PRIMARY, marginLeft: 8 }}
                          >
                            Editar esta
                          </ThemedText>
                        </Pressable>
                        <Pressable
                          onPress={() =>
                            navigation.navigate("SavedAddresses" as never)
                          }
                          style={styles.secondaryButton}
                        >
                          <Feather name="map" size={16} color={PRIMARY} />
                          <ThemedText
                            type="small"
                            style={{ color: PRIMARY, marginLeft: 8 }}
                          >
                            Gestionar direcciones
                          </ThemedText>
                        </Pressable>
                      </View>
                    )}
                  </View>
                  <View style={styles.divider} />
                </>
              )}

              {/* Pickup badge */}
              {orderTypeLocal === "pickup" && (
                <>
                  <View style={styles.pickupBadge}>
                    <Feather name="shopping-bag" size={20} color="#059669" />
                    <ThemedText type="body" style={{ color: "#059669", fontWeight: "600", marginLeft: 8 }}>
                      Recogerás tu pedido en {cart?.businessName}
                    </ThemedText>
                  </View>
                  <View style={styles.divider} />
                </>
              )}

              {/* Payment Method Section */}
              <View style={styles.section}>
                <View style={styles.formSectionHeader}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      flex: 1,
                    }}
                  >
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
                        orderType: orderTypeLocal,
                        // En EUROS: Checkout lo consume como euros al volver
                        // (antes se pasaba en céntimos y el precio se
                        // multiplicaba por 100 al regresar)
                        calculatedDeliveryFee: effectiveDeliveryFee,
                      } as any);
                    }}
                    style={styles.changeButton}
                  >
                    <ThemedText
                      type="small"
                      style={{ color: PRIMARY, fontWeight: "600" }}
                    >
                      Cambiar
                    </ThemedText>
                  </Pressable>
                </View>

                <View style={styles.selectedCard}>
                  <Feather
                    name={
                      paymentMethod === "stripe_card"
                        ? "credit-card"
                        : paymentMethod === "stripe_bizum"
                          ? "smartphone"
                          : paymentMethod === "paypal"
                            ? "dollar-sign"
                            : "zap"
                    }
                    size={24}
                    color="#1F2937"
                  />
                  <View style={{ flex: 1, marginLeft: 16 }}>
                    <ThemedText
                      type="body"
                      style={{ fontWeight: "600", marginBottom: 4 }}
                    >
                      {selectedPaymentMethod?.displayName ||
                        (paymentMethod === "stripe_card"
                          ? "Tarjeta"
                          : paymentMethod === "stripe_bizum"
                            ? "Bizum"
                            : paymentMethod === "paypal"
                              ? "PayPal"
                              : "Binance Pay")}
                    </ThemedText>
                    <ThemedText type="small" style={{ color: "#6B7280" }}>
                      {selectedPaymentMethod?.instructions ||
                        "Pago seguro y automático"}
                    </ThemedText>
                  </View>
                  <Feather name="check-circle" size={20} color={PRIMARY} />
                </View>
              </View>

              <View style={styles.divider} />
              {/* Coupon Section */}
              <View style={styles.section}>
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
                      <ThemedText
                        type="body"
                        style={{
                          fontWeight: "600",
                          color: "#059669",
                          marginBottom: 4,
                        }}
                      >
                        {couponCode.toUpperCase()}
                      </ThemedText>
                      <ThemedText type="small" style={{ color: "#6B7280" }}>
                        Ahorras {couponDiscount.toFixed(2)} €
                      </ThemedText>
                    </View>
                    <Pressable onPress={handleRemoveCoupon}>
                      <Feather name="x" size={20} color="#E60000" />
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
                      style={[
                        styles.applyButton,
                        {
                          opacity:
                            couponLoading || !couponCode.trim() ? 0.5 : 1,
                        },
                      ]}
                    >
                      {couponLoading ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <ThemedText
                          type="body"
                          style={{ color: "#FFF", fontWeight: "600" }}
                        >
                          Aplicar
                        </ThemedText>
                      )}
                    </Pressable>
                  </View>
                )}
              </View>

              <View style={styles.divider} />

              {/* Substitution Section */}
              <View style={styles.section}>
                <View style={styles.formSectionHeader}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Feather name="refresh-cw" size={20} color={PRIMARY} />
                    <ThemedText type="h4" style={{ marginLeft: 12 }}>
                      Si algo no está disponible...
                    </ThemedText>
                  </View>
                </View>
                <ThemedText
                  type="small"
                  style={{ color: "#6B7280", marginBottom: 16 }}
                >
                  Elige qué hacer si un producto está agotado
                </ThemedText>

                <View style={styles.substitutionGrid}>
                  {(
                    ["refund", "call", "substitute"] as SubstitutionOption[]
                  ).map((option) => {
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
                          styles.substitutionCard,
                          isSelected && styles.substitutionCardSelected,
                        ]}
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
                    {showItemSubstitutions
                      ? "Usar misma opción para todos"
                      : "Elegir por producto"}
                  </ThemedText>
                  <Feather
                    name={showItemSubstitutions ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={PRIMARY}
                  />
                </Pressable>

                {showItemSubstitutions && cart && (
                  <View style={{ marginTop: 16 }}>
                    {cart.items.map((item) => {
                      const effective =
                        itemSubstitutions[item.id] || globalSubstitution;
                      const chosenId = substituteProductIds[item.id];
                      return (
                        <View key={item.id} style={styles.itemSubRow}>
                          <ThemedText
                            type="small"
                            style={{ flex: 1 }}
                            numberOfLines={1}
                          >
                            {item.product.name}
                          </ThemedText>
                          <View style={{ flexDirection: "row", gap: 8 }}>
                            {(
                              [
                                "refund",
                                "call",
                                "substitute",
                              ] as SubstitutionOption[]
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
                                    styles.itemSubButton,
                                    isSelected && { backgroundColor: PRIMARY },
                                  ]}
                                >
                                  <Feather
                                    name={info.icon}
                                    size={14}
                                    color={isSelected ? "#FFF" : "#6B7280"}
                                  />
                                </Pressable>
                              );
                            })}
                          </View>
                          {/* Elegir el producto sustituto concreto */}
                          {effective === "substitute" && (
                            <Pressable
                              onPress={() => {
                                Haptics.selectionAsync();
                                setShowSubstitutePicker(item.id);
                              }}
                              style={{
                                width: "100%",
                                marginTop: 8,
                                paddingVertical: 8,
                                paddingHorizontal: 10,
                                borderRadius: 8,
                                backgroundColor: PRIMARY + "12",
                                borderWidth: 1,
                                borderColor: PRIMARY + "40",
                              }}
                            >
                              <ThemedText type="small" style={{ color: PRIMARY }}>
                                {chosenId && substituteName(chosenId)
                                  ? `🔄 Sustituir por: ${substituteName(chosenId)}`
                                  : "🔄 Elegir producto sustituto…"}
                              </ThemedText>
                            </Pressable>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Botón global de sustituto cuando la preferencia es "sustituir" */}
                {!showItemSubstitutions && globalSubstitution === "substitute" && (
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setShowSubstitutePicker("__global__");
                    }}
                    style={{
                      marginTop: 12,
                      paddingVertical: 8,
                      paddingHorizontal: 10,
                      borderRadius: 8,
                      backgroundColor: PRIMARY + "12",
                      borderWidth: 1,
                      borderColor: PRIMARY + "40",
                    }}
                  >
                    <ThemedText type="small" style={{ color: PRIMARY }}>
                      {substituteProductIds["__global__"] &&
                      substituteName(substituteProductIds["__global__"])
                        ? `🔄 Sustituir por: ${substituteName(
                            substituteProductIds["__global__"],
                          )}`
                        : "🔄 Elegir producto sustituto…"}
                    </ThemedText>
                  </Pressable>
                )}
              </View>

              <View style={styles.divider} />

              {/* Tip Section */}
              <View style={styles.section}>
                <View style={styles.formSectionHeader}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Feather name="heart" size={20} color={PRIMARY} />
                    <ThemedText type="h4" style={{ marginLeft: 12 }}>
                      Propina al repartidor
                    </ThemedText>
                  </View>
                </View>
                <ThemedText
                  type="small"
                  style={{ color: "#6B7280", marginBottom: 16 }}
                >
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
                      style={[
                        styles.tipChip,
                        tip === t && styles.tipChipSelected,
                      ]}
                    >
                      <ThemedText
                        type="body"
                        style={{
                          color: tip === t ? "#FFF" : "#1F2937",
                          fontWeight: "600",
                        }}
                      >
                        {t === 0 ? "Sin propina" : `${t} €`}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.divider} />
              {/* Final Summary */}
              <View style={styles.section}>
                <View style={styles.summaryRow}>
                  <ThemedText type="body" style={{ color: "#6B7280" }}>
                    Subtotal
                  </ThemedText>
                  <ThemedText type="body">{subtotal.toFixed(2)} €</ThemedText>
                </View>
                {orderTypeLocal === "delivery" && (
                  <View style={styles.summaryRow}>
                    <ThemedText type="body" style={{ color: "#6B7280" }}>
                      Envío {estimatedTime ? `(~${estimatedTime} min)` : ""}
                    </ThemedText>
                    <ThemedText type="body">
                      {feeResolved
                        ? `${effectiveDeliveryFee.toFixed(2)} €`
                        : "Calculando…"}
                    </ThemedText>
                  </View>
                )}
                {orderTypeLocal === "pickup" && (
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
                      -{couponDiscount.toFixed(2)} €
                    </ThemedText>
                  </View>
                )}
                {tip > 0 && (
                  <View style={styles.summaryRow}>
                    <ThemedText type="body" style={{ color: "#6B7280" }}>
                      Propina
                    </ThemedText>
                    <ThemedText type="body">{tip.toFixed(2)} €</ThemedText>
                  </View>
                )}
                {subDiscount > 0 && (
                  <View style={styles.summaryRow}>
                    <ThemedText type="body" style={{ color: "#7C3AED" }}>
                      ⭐ Descuento Premium
                    </ThemedText>
                    <ThemedText type="body" style={{ color: "#7C3AED" }}>
                      -{subDiscount.toFixed(2)} €
                    </ThemedText>
                  </View>
                )}
                {subDeliveryFee === 0 && orderTypeLocal === "delivery" && (
                  <View style={styles.summaryRow}>
                    <ThemedText type="body" style={{ color: "#7C3AED" }}>
                      ⭐ Envío gratis Premium
                    </ThemedText>
                    <ThemedText type="body" style={{ color: "#7C3AED" }}>
                      €0.00
                    </ThemedText>
                  </View>
                )}
                <View style={[styles.summaryRow, styles.totalRow]}>
                  <ThemedText type="h3">Total</ThemedText>
                  <ThemedText type="h2" style={{ color: PRIMARY }}>
                    {feeResolved && subPreviewDone
                      ? `${totalShown.toFixed(2)} €`
                      : "Calculando…"}
                  </ThemedText>
                </View>
              </View>

              {/* Confirm Button */}
              <Pressable
                onPress={handlePlaceOrder}
                disabled={isLoading || !feeResolved || !subPreviewDone}
                style={[
                  styles.confirmButton,
                  (isLoading || !feeResolved || !subPreviewDone) && {
                    opacity: 0.6,
                  },
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <ThemedText
                    type="h4"
                    style={{ color: "#FFF", fontWeight: "600" }}
                  >
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
                    style={[
                      styles.modalAddress,
                      isSelected && { borderColor: PRIMARY },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <ThemedText
                        type="body"
                        style={{ fontWeight: "600", marginBottom: 4 }}
                      >
                        {addr.label}
                      </ThemedText>
                      <ThemedText type="small" style={{ color: "#6B7280" }}>
                        {addr.street}, {addr.city}
                      </ThemedText>
                    </View>
                    {isSelected && (
                      <Feather name="check-circle" size={18} color={PRIMARY} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setAddressPickerVisible(false);
                  navigation.navigate("AddAddress", {
                    fromCheckout: true,
                  } as never);
                }}
                style={styles.modalButton}
              >
                <Feather name="plus" size={16} color={PRIMARY} />
                <ThemedText
                  type="small"
                  style={{ color: PRIMARY, marginLeft: 8 }}
                >
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
                <ThemedText
                  type="small"
                  style={{ color: PRIMARY, marginLeft: 8 }}
                >
                  Ver todas
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal selector de producto sustituto */}
      <Modal
        visible={showSubstitutePicker !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSubstitutePicker(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowSubstitutePicker(null)}
          />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <ThemedText type="h4">Elige producto sustituto</ThemedText>
              <Pressable onPress={() => setShowSubstitutePicker(null)}>
                <Feather name="x" size={20} color="#1F2937" />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 380 }}>
              {businessProducts.length === 0 ? (
                <ThemedText
                  type="body"
                  style={{
                    color: "#6B7280",
                    textAlign: "center",
                    padding: 24,
                  }}
                >
                  Cargando productos del negocio...
                </ThemedText>
              ) : (
                businessProducts
                  .filter(
                    (p: any) =>
                      p.id !==
                        (showSubstitutePicker === "__global__"
                          ? ""
                          : showSubstitutePicker || "") &&
                      p.available !== false,
                  )
                  .map((product: any) => {
                    const pickerKey = showSubstitutePicker || "";
                    const isSelected =
                      substituteProductIds[pickerKey] === product.id;
                    return (
                      <Pressable
                        key={product.id}
                        onPress={() => {
                          const key = pickerKey;
                          setSubstituteProductIds({
                            ...substituteProductIds,
                            [key]: product.id,
                          });
                          setShowSubstitutePicker(null);
                        }}
                        style={[
                          styles.modalAddress,
                          isSelected && { borderColor: PRIMARY },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <ThemedText
                            type="body"
                            style={{ fontWeight: "600" }}
                          >
                            {product.name}
                          </ThemedText>
                          <ThemedText type="small" style={{ color: "#6B7280" }}>
                            €
                            {typeof product.price === "number"
                              ? (product.price / 100).toFixed(2)
                              : "—"}
                          </ThemedText>
                        </View>
                        {isSelected && (
                          <Feather name="check-circle" size={18} color={PRIMARY} />
                        )}
                      </Pressable>
                    );
                  })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pageContent: { flexGrow: 1 },
  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  formCard: {
    width: "100%",
    maxWidth: 640,
    borderRadius: 16,
    padding: 32,
    ...Platform.select({ web: { boxShadow: "0 4px 20px rgba(0,0,0,0.08)" } }),
  },
  section: { marginBottom: 0 },
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
  // Order type
  orderTypeRow: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
    padding: 4,
  },
  orderTypeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  orderTypeBtnActive: {
    backgroundColor: PRIMARY,
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
    backgroundColor: "#e5e7eb",
    marginVertical: 24,
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
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    padding: 16,
    borderRadius: 12,
    marginBottom: 0,
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