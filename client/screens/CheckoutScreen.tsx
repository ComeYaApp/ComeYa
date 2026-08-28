import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  Modal,
  Image,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
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
import { formatEuros } from "@/utils/currency";
import { useStripePaymentSheet } from "@/hooks/useStripePaymentSheet";

type SubstitutionOption = "refund" | "call" | "substitute";

type PaymentMethod =
  | "stripe_card"
  | "stripe_bizum"
  | "paypal"
  | "bizum_manual"
  | "sepa"
  | "binance";

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

  // Obtener orderType de los parámetros de navegación con validación estricta
  const orderType: "delivery" | "pickup" =
    route?.params?.orderType === "pickup" ? "pickup" : "delivery";

  // FORZAR que orderType se mantenga durante toda la sesión
  // useMemo en lugar de useState para que se actualice si cambian los params
  const confirmedOrderType = React.useMemo<"delivery" | "pickup">(
    () => (route?.params?.orderType === "pickup" ? "pickup" : "delivery"),
    [route?.params?.orderType],
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

  // Cuándo recibir el pedido: ahora o programado
  const [whenMode, setWhenMode] = useState<"asap" | "scheduled">("asap");
  const [scheduledDate, setScheduledDate] = useState<Date>(
    new Date(Date.now() + 60 * 60 * 1000),
  );
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Cargar método de pago guardado como default
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

  // Preferencias de sustitución
  const [globalSubstitution, setGlobalSubstitution] =
    useState<SubstitutionOption>("refund");
  const [itemSubstitutions, setItemSubstitutions] = useState<
    Record<string, SubstitutionOption>
  >({});
  const [showItemSubstitutions, setShowItemSubstitutions] = useState(false);
  const [substituteProductIds, setSubstituteProductIds] = useState<
    Record<string, string>
  >({});
  const [showSubstitutePicker, setShowSubstitutePicker] = useState<
    string | null
  >(null);
  const [businessProducts, setBusinessProducts] = useState<any[]>([]);

  // Cupón
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [subDiscount, setSubDiscount] = useState(0);
  const [subDeliveryFee, setSubDeliveryFee] = useState<number | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [addressPickerVisible, setAddressPickerVisible] = useState(false);

  const loadAddresses = React.useCallback(
    async (preferredId?: string) => {
      if (!user?.id) return;
      try {
        const response = await apiRequest(
          "GET",
          `/api/users/${user.id}/addresses`,
        );
        const data = await response.json();
        console.log(
          "📍 Addresses loaded:",
          data.addresses?.length || 0,
          data.addresses,
        );
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

      // Manejar selección de método de pago
      if (route?.params?.selectedPaymentMethod) {
        console.log(
          "📱 Setting payment method:",
          route.params.selectedPaymentMethod,
        );
        setSelectedPaymentMethod(route.params.selectedPaymentMethod);
        setPaymentMethod(route.params.selectedPaymentMethod.provider);
        // Limpiar el parámetro
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

  const loadBusinessProducts = async () => {
    if (!cart?.businessId) return;
    try {
      const response = await apiRequest(
        "GET",
        `/api/businesses/${cart.businessId}`,
      );
      const data = await response.json();
      if (data.success && data.business?.products) {
        // Adaptar productos igual que en BusinessDetailScreen
        const products = data.business.products.map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description || "",
          price: (p.price || 0) / 100,
          image: p.image || "",
          category: p.category || "General",
          isAvailable:
            p.isAvailable === true ||
            p.isAvailable === 1 ||
            p.is_available === true ||
            p.is_available === 1,
          available:
            p.isAvailable === true ||
            p.isAvailable === 1 ||
            p.is_available === true ||
            p.is_available === 1,
          businessId: p.businessId || p.business_id,
          isWeightBased: p.isWeightBased || p.is_weight_based || false,
          unit: p.unit || "ud",
        }));
        setBusinessProducts(products);
      } else {
        setBusinessProducts([]);
      }
    } catch (error) {
      console.error("Error loading business products:", error);
      setBusinessProducts([]);
    }
  };

// Calculate delivery fee once and store in state
const [finalDeliveryFee, setFinalDeliveryFee] = useState<number | null>(null);

useEffect(() => {
  if (confirmedOrderType === "pickup") {
    setFinalDeliveryFee(0);
    return;
  }

  if (route?.params?.calculatedDeliveryFee) {
    // CartScreen ya pasa el delivery fee en euros, NO dividir por 100
    const fromCart = Number(route.params.calculatedDeliveryFee);
    setFinalDeliveryFee(fromCart > 100 ? fromCart / 100 : fromCart);
  } else if (dynamicDeliveryFee !== null) {
    setFinalDeliveryFee(dynamicDeliveryFee);
  } else if (business?.deliveryFee) {
    // deliveryFee puede venir en centavos (ej: 300) o en euros (ej: 3.00)
    const rawFee = Number(business.deliveryFee);
    setFinalDeliveryFee(rawFee > 100 ? rawFee / 100 : rawFee);
  } else {
    setFinalDeliveryFee(2.5); // Default fallback
  }
}, [
  confirmedOrderType,
  route?.params?.calculatedDeliveryFee,
  dynamicDeliveryFee,
  business?.deliveryFee
]);

const effectiveDeliveryFee = finalDeliveryFee ?? 0;

const total = subtotal + effectiveDeliveryFee - couponDiscount - subDiscount;

// Si el cliente cambia la dirección en el checkout, la tarifa se recotiza
// con la MISMA fórmula del servidor (calculate-delivery): el total mostrado
// coincide con el que recalcula el backend — fin de los importes que
// cambiaban solos entre pantallas.
useEffect(() => {
  if (confirmedOrderType === "pickup" || !cart?.businessId) return;
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
  )
    return;
  apiRequest("POST", "/api/orders/calculate-delivery", {
    businessLat: bizLat,
    businessLng: bizLng,
    deliveryLat: addrLat,
    deliveryLng: addrLng,
  })
    .then((r) => r.json())
    .then((d) => {
      if (d.success && Number.isFinite(Number(d.deliveryFee))) {
        setFinalDeliveryFee(Number(d.deliveryFee) / 100);
      }
    })
    .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [selectedAddress?.id, cart?.businessId, confirmedOrderType]);

  // Beneficios de suscripción
  useEffect(() => {
    if (!user?.id) return;
    const subtotalCents = Math.round(subtotal * 100);
    const deliveryFeeCents = Math.round(effectiveDeliveryFee * 100);
    apiRequest(
      "GET",
      `/api/subscriptions/benefits-preview?subtotal=${subtotalCents}&deliveryFee=${deliveryFeeCents}`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.isActive) {
          setSubDiscount(data.discount / 100);
          setSubDeliveryFee(data.deliveryFee);
        } else {
          setSubDiscount(0);
          setSubDeliveryFee(null);
        }
      })
      .catch(() => {});
  }, [subtotal, effectiveDeliveryFee, user?.id]);

  // Calcular delivery fee dinámico cuando cambia la dirección
  useEffect(() => {
    if (
      business &&
      selectedAddress &&
      selectedAddress.latitude &&
      selectedAddress.longitude
    ) {
      calculateFee();
    }
  }, [business, selectedAddress]);

  const calculateFee = async () => {
    if (!business || !selectedAddress) return;

    const distance = calculateDistance(
      business.latitude || 41.7636,
      business.longitude || -2.4677,
      selectedAddress.latitude,
      selectedAddress.longitude,
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

    // Pedido programado: crear el schedule y salir del flujo normal
    if (whenMode === "scheduled") {
      if (scheduledDate.getTime() < Date.now() + 30 * 60 * 1000) {
        showToast(
          "Programa el pedido al menos 30 minutos en el futuro",
          "error",
        );
        return;
      }
      setIsLoading(true);
      try {
        await apiRequest("POST", "/api/scheduled-orders", {
          businessId: cart.businessId,
          items: JSON.stringify(
            cart.items.map((it: any) => ({
              id: it.id,
              name: it.product?.name,
              price: it.product?.price ?? 0,
              quantity: it.quantity,
            })),
          ),
          scheduledFor: scheduledDate.toISOString(),
          deliveryAddress: `${selectedAddress.street}, ${selectedAddress.city}`,
          deliveryLatitude: selectedAddress.latitude
            ? String(selectedAddress.latitude)
            : undefined,
          deliveryLongitude: selectedAddress.longitude
            ? String(selectedAddress.longitude)
            : undefined,
          paymentMethod: "card",
          notes: null,
        });
        await clearCart();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIsLoading(false);
        showToast("Pedido programado correctamente", "success");
        navigation.reset({
          index: 0,
          routes: [
            { name: "Main" },
            { name: "ScheduledOrders" as never },
          ],
        });
      } catch (error: any) {
        console.error("Error scheduling order:", error);
        showToast("No se pudo programar el pedido", "error");
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const finalItemSubstitutions = showItemSubstitutions
        ? itemSubstitutions
        : {};
      const subtotalCents = Math.round(subtotal * 100);
      // Calcular base sin comisión (revertir el markup del 15%)
      const baseSubtotalCents = Math.round(subtotalCents / 1.15);
      const commissionCents = subtotalCents - baseSubtotalCents;
      const deliveryFeeCents = Math.round(effectiveDeliveryFee * 100);
      const discountCents = appliedCoupon
        ? Math.round(couponDiscount * 100)
        : 0;
      // El total que valida el servidor
      const orderTotal =
        baseSubtotalCents + commissionCents + deliveryFeeCents - discountCents;
      const totalAmount = orderTotal;

      const orderResponse = await apiRequest("POST", "/api/orders", {
        businessId: cart.businessId,
        businessName: cart.businessName,
        businessImage: business?.image || business?.profileImage || "",
        items: JSON.stringify(cart.items),
        status: "pending",
        subtotal: subtotalCents,
        productosBase: baseSubtotalCents,
        nemyCommission: commissionCents,
        deliveryFee: Math.round((finalDeliveryFee ?? 0) * 100),
        total: orderTotal,
        tip: 0,
        paymentMethod,
        orderType: confirmedOrderType,
        deliveryAddressId: selectedAddress.id,
        deliveryAddress: `${selectedAddress.street}, ${selectedAddress.city}`,
        deliveryLatitude: selectedAddress.latitude,
        deliveryLongitude: selectedAddress.longitude,
        substitutionPreference: globalSubstitution,
        itemSubstitutionPreferences:
          Object.keys(finalItemSubstitutions).length > 0
            ? JSON.stringify(finalItemSubstitutions)
            : null,
        couponCode: appliedCoupon ? couponCode.toUpperCase() : null,
        couponDiscount: discountCents || null,
        substituteProductIds:
          Object.keys(substituteProductIds).length > 0
            ? JSON.stringify(substituteProductIds)
            : null,
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

        Haptics.notificationAsync(
          result.success
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Error,
        );
        setIsLoading(false);

        if (result.success) {
          // El carrito SOLO se vacía cuando el pago se completó — antes se
          // limpiaba también al cancelar la ventana de tarjeta y el usuario
          // lo perdía todo (pantalla "No hay productos en el carrito")
          await clearCart();
          navigation.reset({
            index: 0,
            routes: [
              { name: "Main" },
              { name: "OrderTracking", params: { orderId } },
            ],
          });
        } else if (result.error === "Pago cancelado") {
          // Canceló la ventana de pago: el carrito sigue intacto y el pedido
          // huérfano se cancela en el servidor (best-effort) para que el
          // negocio no reciba pedidos que nunca se pagaron
          apiRequest("POST", `/api/orders/${orderId}/cancel-regret`, {})
            .then(() => {})
            .catch(() => {});
          showToast("Pago cancelado — tu carrito sigue intacto", "info");
        } else {
          showToast(result.error || "Error al procesar el pago", "error");
        }
        return;
      }

      // Métodos manuales (Bizum manual, SEPA, PayPal) — navegar a subir comprobante
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
                paymentMethod === "bizum_manual"
                  ? "bizum"
                  : paymentMethod === "sepa"
                    ? "sepa"
                    : "paypal",
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
        style={[
          styles.container,
          {
            backgroundColor: theme.backgroundRoot,
            paddingTop: insets.top + Spacing.lg,
            paddingHorizontal: Spacing.lg,
          },
        ]}
      >
        {/* Header con salida: antes esta pantalla era un fondo negro sin
            botón atrás cuando el carrito quedaba vacío */}
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { backgroundColor: theme.card }]}
          >
            <Feather name="arrow-left" size={22} color={theme.text} />
          </Pressable>
          <ThemedText type="h3">Checkout</ThemedText>
          <View style={{ width: 44 }} />
        </View>
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <Feather
            name="shopping-cart"
            size={44}
            color={theme.textSecondary}
          />
          <ThemedText
            type="h2"
            style={{ marginTop: Spacing.md, textAlign: "center" }}
          >
            No hay productos en el carrito
          </ThemedText>
          <ThemedText
            type="small"
            style={{
              color: theme.textSecondary,
              marginTop: Spacing.sm,
              textAlign: "center",
            }}
          >
            Explora los negocios y añade algo rico
          </ThemedText>
          <Pressable
            onPress={() => navigation.reset({ routes: [{ name: "Main" }] })}
            style={[
              styles.placeOrderButton,
              { backgroundColor: ComeYaColors.primary, marginTop: Spacing.lg },
            ]}
          >
            <ThemedText
              type="body"
              style={{ color: "#FFFFFF", fontWeight: "600" }}
            >
              Explorar negocios
            </ThemedText>
          </Pressable>
        </View>
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
        orderTotal: Math.round((subtotal + (finalDeliveryFee ?? 0)) * 100),
      });
      const data = await response.json();

      if (data.valid) {
        const discount =
          data.discountType === "percentage"
            ? ((subtotal + effectiveDeliveryFee) * data.discount) / 100
            : data.discount / 100;

        const maxDiscount = data.coupon.maxDiscountAmount
          ? data.coupon.maxDiscountAmount / 100
          : discount;
        const finalDiscount = Math.min(discount, maxDiscount);

        setAppliedCoupon(data.coupon);
        setCouponDiscount(finalDiscount);
        showToast(
          `¡Cupón aplicado! Ahorras ${formatEuros(finalDiscount)}`,
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
                  navigation.navigate("AddAddress", {
                    fromCheckout: true,
                  } as never);
                }}
                style={[
                  styles.manageAddressButton,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <Feather name="plus" size={16} color={ComeYaColors.primary} />
                <ThemedText
                  type="small"
                  style={{
                    color: ComeYaColors.primary,
                    marginLeft: Spacing.xs,
                  }}
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
                  style={{
                    color: ComeYaColors.primary,
                    marginLeft: Spacing.xs,
                  }}
                >
                  Ver todas
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para seleccionar producto sustituto */}
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
              <ThemedText type="h4">Elige producto sustituto</ThemedText>
              <Pressable onPress={() => setShowSubstitutePicker(null)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {businessProducts.length === 0 ? (
                <ThemedText
                  type="body"
                  style={{
                    color: theme.textSecondary,
                    textAlign: "center",
                    padding: Spacing.xl,
                  }}
                >
                  Cargando productos del negocio...
                </ThemedText>
              ) : (
                businessProducts
                  .filter(
                    (p: any) =>
                      p.id !== showSubstitutePicker?.replace("__global__", "") &&
                      p.available !== false
                  )
                  .map((product: any) => {
                    const selectedProductId =
                      showSubstitutePicker === "__global__"
                        ? ""
                        : showSubstitutePicker || "";
                    const isSelected =
                      substituteProductIds[selectedProductId] === product.id ||
                      substituteProductIds[showSubstitutePicker || ""] ===
                        product.id;
                    return (
                      <Pressable
                        key={product.id}
                        onPress={() => {
                          const key =
                            showSubstitutePicker === "__global__"
                              ? showSubstitutePicker
                              : showSubstitutePicker || "";
                          setSubstituteProductIds({
                            ...substituteProductIds,
                            [key]: product.id,
                          });
                          setShowSubstitutePicker(null);
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
                        <Image
                          source={{
                            uri:
                              product.image ||
                              "https://res.cloudinary.com/dkuj3vq57/image/upload/v1/comeya/placeholder-food.jpg",
                          }}
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: BorderRadius.sm,
                            marginRight: Spacing.md,
                          }}
                          resizeMode="cover"
                        />
                        <View style={{ flex: 1 }}>
                          <ThemedText
                            type="body"
                            style={{ fontWeight: "600" }}
                          >
                            {product.name}
                          </ThemedText>
                          <ThemedText
                            type="small"
                            style={{ color: theme.textSecondary }}
                          >
                            €
                            {typeof product.price === "number"
                              ? product.price.toFixed(2)
                              : product.price}
                            {product.isWeightBased
                              ? ` /${product.unit || "ud"}`
                              : ""}
                          </ThemedText>
                        </View>
                        {isSelected ? (
                          <Feather
                            name="check-circle"
                            size={20}
                            color={ComeYaColors.primary}
                          />
                        ) : null}
                      </Pressable>
                    );
                  })
              )}
            </ScrollView>
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
            <View
              style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
            >
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
              <ThemedText
                type="small"
                style={{ color: ComeYaColors.primary, marginLeft: Spacing.xs }}
              >
                Cambiar
              </ThemedText>
            </Pressable>
          </View>
          {addresses.length === 0 ? (
            <Pressable
              onPress={() =>
                navigation.navigate("AddAddress", {
                  fromCheckout: true,
                } as never)
              }
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
                  style={{
                    color: ComeYaColors.primary,
                    marginLeft: Spacing.sm,
                  }}
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
                accessibilityHint={
                  selectedAddress?.id === addr.id
                    ? "Dirección seleccionada"
                    : "Toca para seleccionar esta dirección"
                }
                accessibilityRole="radio"
                accessibilityState={{
                  checked: selectedAddress?.id === addr.id,
                }}
              >
                <View style={styles.addressContent}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    {addr.label}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary }}
                  >
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
                onPress={() =>
                  navigation.navigate("AddAddress", {
                    address: selectedAddress,
                    fromCheckout: true,
                  } as never)
                }
                style={[
                  styles.manageAddressButton,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <Feather name="edit-2" size={16} color={ComeYaColors.primary} />
                <ThemedText
                  type="small"
                  style={{
                    color: ComeYaColors.primary,
                    marginLeft: Spacing.xs,
                  }}
                >
                  Editar esta
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => navigation.navigate("SavedAddresses" as never)}
                style={[
                  styles.manageAddressButton,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <Feather name="map" size={16} color={ComeYaColors.primary} />
                <ThemedText
                  type="small"
                  style={{
                    color: ComeYaColors.primary,
                    marginLeft: Spacing.xs,
                  }}
                >
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
            <Feather
              name="credit-card"
              size={20}
              color={ComeYaColors.primary}
            />
            <ThemedText type="h4" style={styles.sectionTitle}>
              Método de pago
            </ThemedText>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
navigation.navigate("DigitalPaymentMethod", {
  orderTotal: total,
  orderType: confirmedOrderType,
  calculatedDeliveryFee: finalDeliveryFee ? finalDeliveryFee * 100 : 0,
} as any);
              }}
              style={styles.inlineLink}
            >
              <Feather name="edit-3" size={16} color={ComeYaColors.primary} />
              <ThemedText
                type="small"
                style={{ color: ComeYaColors.primary, marginLeft: Spacing.xs }}
              >
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
                color={theme.text}
              />
              <View style={styles.paymentText}>
                <ThemedText type="body" style={{ fontWeight: "600" }}>
                  {selectedPaymentMethod?.displayName ||
                    (paymentMethod === "stripe_card"
                      ? "Tarjeta"
                      : paymentMethod === "stripe_bizum"
                        ? "Bizum"
                        : paymentMethod === "paypal"
                          ? "PayPal"
                          : "Binance Pay")}
                </ThemedText>
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary }}
                >
                  {selectedPaymentMethod?.instructions ||
                    "Pago seguro y automático"}
                </ThemedText>
              </View>
            </View>
            <Feather
              name="check-circle"
              size={20}
              color={ComeYaColors.primary}
            />
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
            <View
              style={[
                styles.appliedCouponBox,
                {
                  backgroundColor: ComeYaColors.success + "15",
                  borderColor: ComeYaColors.success,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <ThemedText
                  type="body"
                  style={{ fontWeight: "600", color: ComeYaColors.success }}
                >
                  {couponCode.toUpperCase()}
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginTop: 4 }}
                >
                  Ahorras {formatEuros(couponDiscount)}
                </ThemedText>
              </View>
              <Pressable
                onPress={handleRemoveCoupon}
                style={styles.removeCouponButton}
              >
                <Feather name="x" size={20} color={ComeYaColors.error} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.couponInputContainer}>
              <TextInput
                style={[
                  styles.couponInput,
                  {
                    color: theme.text,
                    backgroundColor: theme.backgroundSecondary,
                    borderColor: theme.border,
                  },
                ]}
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
                style={[
                  styles.applyCouponButton,
                  {
                    backgroundColor:
                      couponLoading || !couponCode.trim()
                        ? theme.textSecondary
                        : ComeYaColors.primary,
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
                      if (option === "substitute") {
                        loadBusinessProducts();
                        setShowSubstitutePicker("__global__");
                      }
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
                      numberOfLines={2}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                      style={{
                        color: isSelected ? ComeYaColors.primary : theme.text,
                        marginTop: Spacing.xs,
                        fontWeight: isSelected ? "600" : "400",
                        textAlign: "center",
                        width: "100%",
                        lineHeight: 16,
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
                            if (option === "substitute") {
                              loadBusinessProducts();
                              setShowSubstitutePicker(item.product.id);
                            }
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

        {/* Cuándo recibir el pedido */}
        <View
          style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}
        >
          <View style={styles.sectionHeader}>
            <Feather
              name="clock"
              size={20}
              color={ComeYaColors.primary}
            />
            <ThemedText type="h4" style={styles.sectionTitle}>
              ¿Cuándo lo quieres?
            </ThemedText>
          </View>
          <View style={styles.whenRow}>
            <Pressable
              onPress={() => setWhenMode("asap")}
              style={[
                styles.whenOption,
                {
                  borderColor:
                    whenMode === "asap"
                      ? ComeYaColors.primary
                      : theme.border,
                  backgroundColor:
                    whenMode === "asap"
                      ? ComeYaColors.primary + "12"
                      : "transparent",
                },
              ]}
            >
              <Feather
                name="zap"
                size={16}
                color={
                  whenMode === "asap" ? ComeYaColors.primary : theme.textSecondary
                }
              />
              <ThemedText
                type="small"
                style={{
                  color: whenMode === "asap" ? ComeYaColors.primary : theme.text,
                  fontWeight: "600",
                }}
              >
                Lo antes posible
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setWhenMode("scheduled")}
              style={[
                styles.whenOption,
                {
                  borderColor:
                    whenMode === "scheduled"
                      ? ComeYaColors.primary
                      : theme.border,
                  backgroundColor:
                    whenMode === "scheduled"
                      ? ComeYaColors.primary + "12"
                      : "transparent",
                },
              ]}
            >
              <Feather
                name="calendar"
                size={16}
                color={
                  whenMode === "scheduled"
                    ? ComeYaColors.primary
                    : theme.textSecondary
                }
              />
              <ThemedText
                type="small"
                style={{
                  color:
                    whenMode === "scheduled" ? ComeYaColors.primary : theme.text,
                  fontWeight: "600",
                }}
              >
                Programar
              </ThemedText>
            </Pressable>
          </View>
          {whenMode === "scheduled" && (
            <Pressable
              onPress={() => setShowDatePicker(true)}
              style={styles.scheduleValue}
            >
              <Feather name="calendar" size={16} color={theme.textSecondary} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm, flex: 1 }}>
                {scheduledDate.toLocaleDateString("es-ES", {
                  weekday: "long",
                  day: "numeric",
                  month: "short",
                })}{" "}
                ·{" "}
                {scheduledDate.toLocaleTimeString("es-ES", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </ThemedText>
              <ThemedText
                type="caption"
                style={{ color: ComeYaColors.primary, fontWeight: "600" }}
              >
                Cambiar
              </ThemedText>
            </Pressable>
          )}
          {whenMode === "scheduled" && showDatePicker && (
            <DateTimePicker
              value={scheduledDate}
              mode="datetime"
              minimumDate={new Date(Date.now() + 30 * 60 * 1000)}
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(event: any, date?: Date) => {
                setShowDatePicker(Platform.OS === "ios");
                if (date) setScheduledDate(date);
                if (Platform.OS === "android" && event.type !== "dismissed") {
                  setShowDatePicker(false);
                }
              }}
            />
          )}
          {whenMode === "scheduled" && Platform.OS === "ios" && showDatePicker && (
            <Pressable
              onPress={() => setShowDatePicker(false)}
              style={{ alignItems: "center", paddingVertical: Spacing.xs }}
            >
              <ThemedText
                type="caption"
                style={{ color: ComeYaColors.primary, fontWeight: "600" }}
              >
                Hecho
              </ThemedText>
            </Pressable>
          )}
        </View>

        <View
          style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}
        >
          <View style={styles.sectionHeader}>
            <Feather
              name="shopping-bag"
              size={20}
              color={ComeYaColors.primary}
            />
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
          {cart.items.map((item) => {
            const itemPref = showItemSubstitutions
              ? itemSubstitutions[item.id]
              : null;
            const itemInfo = itemPref
              ? getSubstitutionInfo(itemPref)
              : null;
            // Nombre del producto sustituto elegido para este ítem
            const chosenSubstituteId = substituteProductIds[item.id];
            const chosenSubstitute = chosenSubstituteId
              ? businessProducts.find((p: any) => p.id === chosenSubstituteId)
              : null;
            return (
              <View key={item.id} style={styles.summaryItem}>
                <View style={{ flex: 1, paddingRight: Spacing.sm }}>
                  <ThemedText type="small">
                    {item.quantity}x {item.product.name}
                  </ThemedText>
                  {/* Constancia de la preferencia de indisponibilidad por
                      producto (facturación/reclamaciones) */}
                  {itemInfo && (
                    <ThemedText
                      type="caption"
                      style={{ color: theme.textSecondary, marginTop: 1 }}
                    >
                      {itemInfo.label === "Sustituir" && chosenSubstitute
                        ? `Si no está disponible: sustituir por ${chosenSubstitute.name}`
                        : `Si no está disponible: ${itemInfo.label}`}
                    </ThemedText>
                  )}
                </View>
                <ThemedText type="small">
                  {formatEuros(item.product.price * item.quantity)}
                </ThemedText>
              </View>
            );
          })}

          {/* Preferencia global de indisponibilidad en el resumen */}
          {(() => {
            const globalInfo = getSubstitutionInfo(globalSubstitution);
            return (
              <View
                style={[
                  styles.summarySubstitution,
                  { borderColor: theme.border },
                ]}
              >
                <Feather
                  name={globalInfo.icon}
                  size={14}
                  color={theme.textSecondary}
                />
                <ThemedText
                  type="caption"
                  style={{
                    color: theme.textSecondary,
                    marginLeft: Spacing.xs,
                    flex: 1,
                  }}
                >
                  Si algo no está disponible: {globalInfo.label} (
                  {globalInfo.desc})
                </ThemedText>
              </View>
            );
          })()}

          {/* Pedido programado visible en el resumen */}
          {whenMode === "scheduled" && scheduledDate && (
            <View
              style={[styles.summarySubstitution, { borderColor: ComeYaColors.primary + "40" }]}
            >
              <Feather name="clock" size={14} color={ComeYaColors.primary} />
              <ThemedText
                type="caption"
                style={{
                  color: ComeYaColors.primary,
                  marginLeft: Spacing.xs,
                  flex: 1,
                  fontWeight: "600",
                }}
              >
                Programado para:{" "}
                {new Date(scheduledDate).toLocaleString("es-ES", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </ThemedText>
            </View>
          )}
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
          <ThemedText type="body">{formatEuros(subtotal)}</ThemedText>
        </View>
        {confirmedOrderType === "delivery" && (
          <View style={styles.totalRow}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Envío {estimatedTime ? `(~${estimatedTime} min)` : ""}
            </ThemedText>
            <ThemedText type="body">{formatEuros(finalDeliveryFee ?? 0)}</ThemedText>
          </View>
        )}
        {confirmedOrderType === "pickup" && (
          <View
            style={[
              styles.totalRow,
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
        {couponDiscount > 0 && (
          <View style={styles.totalRow}>
            <ThemedText type="body" style={{ color: ComeYaColors.success }}>
              Cupón ({couponCode})
            </ThemedText>
            <ThemedText type="body" style={{ color: ComeYaColors.success }}>
              -{formatEuros(couponDiscount)}
            </ThemedText>
          </View>
        )}
        {subDiscount > 0 && (
          <View style={styles.totalRow}>
            <ThemedText type="body" style={{ color: "#7C3AED" }}>
              ⭐ Descuento Premium
            </ThemedText>
            <ThemedText type="body" style={{ color: "#7C3AED" }}>
              -{formatEuros(subDiscount)}
            </ThemedText>
          </View>
        )}
        {subDeliveryFee === 0 && confirmedOrderType === "delivery" && (
          <View style={styles.totalRow}>
            <ThemedText type="body" style={{ color: "#7C3AED" }}>
              ⭐ Envío gratis Premium
            </ThemedText>
            <ThemedText type="body" style={{ color: "#7C3AED" }}>
              €0.00
            </ThemedText>
          </View>
        )}
        <View style={[styles.totalRow, styles.grandTotal]}>
          <ThemedText type="h3">Total</ThemedText>
          <ThemedText type="h2" style={{ color: ComeYaColors.primary }}>
            {formatEuros(total)}
          </ThemedText>
        </View>
        <Button onPress={handlePlaceOrder} disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : whenMode === "scheduled" ? (
            "Programar pedido"
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 200,
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
  whenRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  whenOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  scheduleValue: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
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
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  substitutionOption: {
    flex: 1,
    minWidth: "28%", // en pantallas estrechas pasan a 2 por fila, sin cortar texto
    minHeight: 84,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
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
  summarySubstitution: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginTop: Spacing.md,
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
  placeOrderButton: {
    height: 50,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
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
