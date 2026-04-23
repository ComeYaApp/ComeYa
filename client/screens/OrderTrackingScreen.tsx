import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  Dimensions,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemedText } from "@/components/ThemedText";
import { OrderProgressBar } from "@/components/OrderProgressBar";
import { CollapsibleMap } from "@/components/CollapsibleMap";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { Order } from "@/types";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { mockOrders } from "@/data/mockData";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { useAuth } from "@/contexts/AuthContext";

type OrderTrackingRouteProp = RouteProp<RootStackParamList, "OrderTracking">;
type OrderTrackingNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "OrderTracking"
>;

const ORDERS_KEY = "@ComeYa_orders";
const { width } = Dimensions.get("window");

const parseDeliveryAddress = (address: string | null): string => {
  if (!address) return "Dirección no disponible";
  try {
    const parsed = JSON.parse(address);
    if (typeof parsed === "object") {
      const parts = [parsed.street, parsed.city, parsed.state, parsed.zipCode].filter(Boolean);
      return parts.join(", ") || address;
    }
    return address;
  } catch {
    return address;
  }
};

export default function OrderTrackingScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<OrderTrackingRouteProp>();
  const navigation = useNavigation<OrderTrackingNavigationProp>();
  const { theme } = useTheme();
  const { user } = useAuth();

  const { orderId } = route.params;
  const [order, setOrder] = useState<Order | null>(null);
  const [orderType, setOrderType] = useState<'delivery' | 'pickup'>('delivery');
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [deliveryLocation, setDeliveryLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [businessLocation, setBusinessLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [driverPhoto, setDriverPhoto] = useState<string | null>(null);
  const [selectedTip, setSelectedTip] = useState<number | null>(null);
  const [tipSent, setTipSent] = useState(false);
  const [sendingTip, setSendingTip] = useState(false);
  const [dynamicETA, setDynamicETA] = useState<{ minutes: number; confidence: number } | null>(null);

  const tipOptions = [10, 20, 30, 50];

  const handleSendTip = async () => {
    if (!selectedTip || !order?.deliveryPersonId || sendingTip) return;
    setSendingTip(true);
    try {
      await apiRequest("POST", `/api/orders/${orderId}/tip`, {
        amount: selectedTip,
        deliveryPersonId: order.deliveryPersonId,
      });
      setTipSent(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.log("Error sending tip");
    } finally {
      setSendingTip(false);
    }
  };

  // Poll for ETA updates every 30 seconds
  useEffect(() => {
    const fetchETA = async () => {
      if (!orderId) return;
      try {
        const response = await apiRequest('GET', `/api/tracking/eta/${orderId}`);
        const data = await response.json();
        if (data.success && data.eta) {
          setDynamicETA({
            minutes: data.eta.minutes,
            confidence: data.eta.confidence,
          });
        }
      } catch (error) {
        console.log('ETA not available');
      }
    };

    fetchETA();
    const interval = setInterval(fetchETA, 30000);
    return () => clearInterval(interval);
  }, [orderId]);

  // Poll for delivery person location every 10 seconds
  useEffect(() => {
    const fetchDeliveryLocation = async () => {
      if (!orderId) return;
      try {
        const response = await fetch(
          new URL(`/api/delivery/location/${orderId}`, getApiUrl()).toString(),
        );
        if (response.ok) {
          const data = await response.json();
          if (data.location) {
            setDeliveryLocation({
              latitude: parseFloat(data.location.latitude),
              longitude: parseFloat(data.location.longitude),
            });
          }
        }
      } catch (error) {
        // Silently handle delivery location errors - this is expected for demo orders
        console.log("Delivery location not available for this order");
      }
    };

    fetchDeliveryLocation();
    const interval = setInterval(fetchDeliveryLocation, 10000);
    return () => clearInterval(interval);
  }, [orderId]);

  // Request location permission + watch position
  useEffect(() => {
    if (Platform.OS === "web") return;
    let sub: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      // Get immediate fix
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      // Watch for updates
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 20 },
        (l) => setUserLocation({ latitude: l.coords.latitude, longitude: l.coords.longitude })
      );
    })();

    return () => { sub?.remove(); };
  }, []);

  useEffect(() => {
    const loadOrder = async () => {
      try {
        const response = await apiRequest("GET", `/api/orders/${orderId}`);
        const data = await response.json();
        if (data.order) {
          const apiOrder = data.order;
          const transformedOrder: Order = {
            id: apiOrder.id,
            userId: apiOrder.userId,
            businessId: apiOrder.businessId,
            businessName: apiOrder.businessName,
            businessImage: apiOrder.businessImage || "",
            items:
              typeof apiOrder.items === "string"
                ? JSON.parse(apiOrder.items)
                : apiOrder.items,
            status: apiOrder.status,
            subtotal: apiOrder.subtotal / 100,
            productosBase: apiOrder.productosBase ? apiOrder.productosBase / 100 : undefined,
            nemyCommission: apiOrder.nemyCommission ? apiOrder.nemyCommission / 100 : undefined,
            deliveryFee: apiOrder.deliveryFee / 100,
            total: apiOrder.total / 100,
            paymentMethod: apiOrder.paymentMethod,
            deliveryAddress: parseDeliveryAddress(apiOrder.deliveryAddress),
            createdAt: apiOrder.createdAt,
            estimatedDelivery: apiOrder.estimatedDelivery,
            deliveryPersonId: apiOrder.deliveryPersonId,
            deliveryPersonName: apiOrder.deliveryPersonName,
            deliveryPersonPhone: apiOrder.deliveryPersonPhone,
          };
          setOrder(transformedOrder);
          setOrderType(apiOrder.orderType || 'delivery');

          // Cargar ubicación real del negocio
          if (apiOrder.businessId) {
            try {
              const bizRes = await apiRequest("GET", `/api/business/${apiOrder.businessId}`);
              const bizData = await bizRes.json();
              const biz = bizData.business;
              if (biz?.latitude && biz?.longitude) {
                setBusinessLocation({
                  latitude: parseFloat(biz.latitude),
                  longitude: parseFloat(biz.longitude),
                });
              }
            } catch { /* sin ubicación del negocio */ }
          }

          // Cargar foto del repartidor
          if (apiOrder.deliveryPersonId) {
            try {
              const driverRes = await apiRequest("GET", `/api/users/${apiOrder.deliveryPersonId}`);
              const driverData = await driverRes.json();
              if (driverData.user?.profilePicture) {
                setDriverPhoto(driverData.user.profilePicture);
              }
            } catch { /* sin foto del repartidor */ }
          }
          return;
        }
      } catch (error: any) {
        console.error("Error loading order from API:", error);
        // If API fails, try to load from local storage or use mock data
      }

      try {
        const stored = await AsyncStorage.getItem(ORDERS_KEY);
        const savedOrders: Order[] = stored ? JSON.parse(stored) : [];
        const allOrders = [...savedOrders, ...mockOrders];
        const foundOrder = allOrders.find((o) => o.id === orderId);

        if (foundOrder) {
          setOrder(foundOrder);
        } else {
          // Create a mock order for demonstration
          const mockOrder: Order = {
            id: orderId,
            userId: "user_demo",
            businessId: "business_demo",
            businessName: "Restaurante Demo",
            businessImage:
              "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400",
            items: [
              {
                id: "item_1",
                quantity: 2,
                product: {
                  id: "prod_1",
                  name: "Tacos al Pastor",
                  price: 15.0,
                  image:
                    "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400",
                },
              },
            ],
            status: "preparing",
            subtotal: 30.0,
            deliveryFee: 25.0,
            total: 55.0,
            paymentMethod: "card",
            deliveryAddress: "Calle Ejemplo 123, Soria, España",
            createdAt: new Date().toISOString(),
            estimatedDelivery: new Date(
              Date.now() + 30 * 60 * 1000,
            ).toISOString(),
            deliveryPersonId: "delivery_demo",
            deliveryPersonName: "Carlos Repartidor",
            deliveryPersonPhone: "+34600000000",
          };
          setOrder(mockOrder);
        }
      } catch (error) {
        console.error("Error loading order from storage:", error);
        // Fallback to mock orders
        const foundOrder = mockOrders.find((o) => o.id === orderId);
        setOrder(foundOrder || null);
      }
    };

    loadOrder();

    // Poll for order updates every 30 seconds
    const interval = setInterval(loadOrder, 30000);
    return () => clearInterval(interval);
  }, [orderId]);

  const handleCall = (phone: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(`tel:${phone}`);
  };

  const handleWhatsApp = (phone: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const cleanPhone = phone.replace(/\D/g, "");
    Linking.openURL(`https://wa.me/${cleanPhone}`);
  };

  if (!order) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      >
        <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="h2">Seguimiento</ThemedText>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.notFound}>
          <ThemedText type="h3">Pedido no encontrado</ThemedText>
        </View>
      </View>
    );
  }

  const getStatusMinutes = (
    status: string,
  ): { min: number; max: number } | null => {
    switch (status) {
      case "pending":
        return { min: 35, max: 50 };
      case "accepted":
        return { min: 25, max: 40 };
      case "preparing":
        return { min: 15, max: 25 };
      case "on_the_way":
        return { min: 5, max: 15 };
      case "delivered":
      case "cancelled":
        return null;
      default:
        return { min: 30, max: 45 };
    }
  };

  const etaRange = dynamicETA 
    ? `${dynamicETA.minutes} min` 
    : getStatusMinutes(order.status) 
    ? `${getStatusMinutes(order.status)!.min}-${getStatusMinutes(order.status)!.max} min` 
    : null;

  const estimatedTime = order.estimatedDelivery
    ? new Date(order.estimatedDelivery).toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const nemyCommission = order.nemyCommission
    ? order.nemyCommission / 100
    : order.subtotal * 0.15;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h2">Seguimiento</ThemedText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Countdown Timer */}
        {dynamicETA && (
          <View style={[styles.statusCard, { backgroundColor: theme.card }, Shadows.md]}>
            <View style={styles.businessRow}>
              <View style={[styles.iconContainer, { backgroundColor: ComeYaColors.primary + '20' }]}>
                <Feather name="clock" size={24} color={ComeYaColors.primary} />
              </View>
              <View style={styles.businessInfo}>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  {order.status === 'pending' ? 'Esperando confirmación' :
                   order.status === 'accepted' ? 'Pedido aceptado' : 
                   order.status === 'preparing' ? 'Preparando tu pedido' :
                   order.status === 'on_the_way' ? 'En camino' : 'Procesando'}
                </ThemedText>
                <ThemedText type="h3" style={{ color: ComeYaColors.primary }}>
                  {dynamicETA.minutes} min
                </ThemedText>
              </View>
            </View>
          </View>
        )}

        {/* Buscando repartidor - SOLO PARA DELIVERY */}
        {orderType === 'delivery' && (order as any).searchingDriver && (
          <View style={[styles.statusCard, { backgroundColor: ComeYaColors.warning + '15', borderWidth: 1, borderColor: ComeYaColors.warning }, Shadows.md]}>
            <View style={styles.businessRow}>
              <ActivityIndicator size="small" color={ComeYaColors.warning} />
              <View style={[styles.businessInfo, { marginLeft: Spacing.md }]}>
                <ThemedText type="h4" style={{ color: ComeYaColors.warning }}>
                  Buscando repartidor disponible...
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Esto puede tomar unos minutos
                </ThemedText>
              </View>
            </View>
          </View>
        )}

        {/* Progress Bar */}
        <OrderProgressBar status={order.status} orderType={orderType} />

        <View
          style={[
            styles.statusCard,
            { backgroundColor: theme.card },
            Shadows.md,
          ]}
        >
          <View style={styles.businessRow}>
            <Image
              source={
                order.businessImage
                  ? { uri: order.businessImage }
                  : require("../../assets/images/delivery-hero.png")
              }
              style={styles.businessImage}
              contentFit="cover"
            />
            <View style={styles.businessInfo}>
              <ThemedText type="h4">{order.businessName}</ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Pedido #{order.id.slice(-6)}
              </ThemedText>
            </View>
            {dynamicETA ? (
              <View style={styles.etaContainer}>
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary }}
                >
                  ETA
                </ThemedText>
                <ThemedText type="h3" style={{ color: ComeYaColors.primary }}>
                  {etaRange}
                </ThemedText>
              </View>
            ) : order.status === "delivered" ? (
              <View style={styles.etaContainer}>
                <Feather name="check-circle" size={24} color="#4CAF50" />
                <ThemedText
                  type="caption"
                  style={{ color: "#4CAF50", marginTop: 4 }}
                >
                  Entregado
                </ThemedText>
              </View>
            ) : null}
          </View>
        </View>

        {/* Mapa - Diferente según orderType */}
        {orderType === 'delivery' ? (
          <CollapsibleMap
            businessLocation={businessLocation || undefined}
            deliveryPersonLocation={deliveryLocation || undefined}
            customerLocation={userLocation || undefined}
            driverName={order.deliveryPersonName}
            driverPhoto={driverPhoto || undefined}
            eta={etaRange ?? undefined}
            status={order.status}
            onCallDriver={order.deliveryPersonPhone ? () => handleCall(order.deliveryPersonPhone!) : undefined}
            onChatDriver={order.deliveryPersonId ? () => navigation.navigate("OrderChat", {
              orderId: order.id,
              receiverId: order.deliveryPersonId!,
              receiverName: order.deliveryPersonName ?? "Repartidor",
            }) : undefined}
          />
        ) : (
          <CollapsibleMap
            businessLocation={businessLocation || undefined}
            customerLocation={userLocation || undefined}
            status={order.status}
            isPickup={true}
          />
        )}

        <View
          style={[
            styles.addressCard,
            { backgroundColor: theme.card },
            Shadows.sm,
          ]}
        >
          <View style={styles.addressHeader}>
            <Feather name={orderType === 'pickup' ? "shopping-bag" : "map-pin"} size={20} color={ComeYaColors.primary} />
            <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
              {orderType === 'pickup' ? 'Dirección del negocio' : 'Dirección de entrega'}
            </ThemedText>
          </View>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            {order.deliveryAddress}
          </ThemedText>
          {orderType === 'pickup' && order.status === 'ready' && (
            <View style={{ marginTop: Spacing.md, padding: Spacing.md, backgroundColor: ComeYaColors.success + '15', borderRadius: BorderRadius.sm }}>
              <ThemedText type="small" style={{ color: ComeYaColors.success, fontWeight: '600' }}>
                ✅ Tu pedido está listo para recoger
              </ThemedText>
            </View>
          )}
        </View>

        <View
          style={[
            styles.orderDetails,
            { backgroundColor: theme.card },
            Shadows.sm,
          ]}
        >
          <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
            Detalles del pedido
          </ThemedText>
          {order.items && Array.isArray(order.items) && order.items.length > 0 ? (
            order.items.map((item, index) => {
              const itemName = item.product?.name || item.name || "Producto";
              let itemPrice = item.product?.price || item.price || 0;
              // Si el precio parece estar en centavos (mayor a 1000), dividir por 100
              if (itemPrice > 1000) itemPrice = itemPrice / 100;
              const itemQty = item.quantity || 1;
              return (
                <View key={item.id || `item-${index}`} style={styles.itemRow}>
                  <ThemedText type="body">
                    {itemQty}x {itemName}
                  </ThemedText>
                  <ThemedText type="body">
                    €{(itemPrice * itemQty).toFixed(2)}
                  </ThemedText>
                </View>
              );
            })
          ) : (
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              No hay items en este pedido
            </ThemedText>
          )}
          <View style={[styles.totalSection, { borderTopColor: theme.border }]}>
            <View style={styles.itemRow}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Subtotal
              </ThemedText>
              <ThemedText type="small">€{order.subtotal.toFixed(2)}</ThemedText>
            </View>
            {orderType === 'delivery' && (
              <>
                <View style={styles.itemRow}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    Comision ComeYa (15%)
                  </ThemedText>
                  <ThemedText type="small">€{nemyCommission.toFixed(2)}</ThemedText>
                </View>
                <View style={styles.itemRow}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    Envío
                  </ThemedText>
                  <ThemedText type="small">
                    €{order.deliveryFee.toFixed(2)}
                  </ThemedText>
                </View>
              </>
            )}
            <View style={styles.itemRow}>
              <ThemedText type="h4">Total</ThemedText>
              <ThemedText type="h4" style={{ color: ComeYaColors.primary }}>
                €{order.total.toFixed(2)}
              </ThemedText>
            </View>
          </View>
          <View style={styles.paymentRow}>
            <Feather name="credit-card" size={16} color={theme.textSecondary} />
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
              {order.paymentMethod === 'pago_movil' ? 'Pago Móvil' :
               order.paymentMethod === 'binance_pay' ? 'Binance Pay' :
               order.paymentMethod === 'zinli' ? 'Zinli' :
               order.paymentMethod === 'zelle' ? 'Zelle' :
               order.paymentMethod === 'paypal' ? 'PayPal' :
               order.paymentMethod === 'cash' ? 'Efectivo' :
               'Tarjeta'}
            </ThemedText>
          </View>
        </View>

        {order.status === "delivered" && order.deliveryPersonId && !tipSent && user?.role === "customer" ? (
          <View
            style={[
              styles.tipCard,
              { backgroundColor: theme.card },
              Shadows.md,
            ]}
          >
            <View style={styles.tipHeader}>
              <Feather name="heart" size={20} color={ComeYaColors.primary} />
              <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
                Agregar propina
              </ThemedText>
            </View>
            <ThemedText
              type="body"
              style={{ color: theme.textSecondary, marginBottom: Spacing.md }}
            >
              Agradece a tu repartidor por su servicio
            </ThemedText>
            <View style={styles.tipOptions}>
              {tipOptions.map((tip) => (
                <Pressable
                  key={tip}
                  onPress={() => {
                    setSelectedTip(tip);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={[
                    styles.tipOption,
                    {
                      backgroundColor:
                        selectedTip === tip
                          ? ComeYaColors.primary
                          : theme.backgroundSecondary,
                      borderColor:
                        selectedTip === tip ? ComeYaColors.primary : theme.border,
                    },
                  ]}
                >
                  <ThemedText
                    type="body"
                    style={{
                      color: selectedTip === tip ? "#FFFFFF" : theme.text,
                      fontWeight: "600",
                    }}
                  >
                    �${tip}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={handleSendTip}
              disabled={!selectedTip || sendingTip}
              style={[
                styles.tipButton,
                {
                  backgroundColor: selectedTip
                    ? ComeYaColors.primary
                    : theme.backgroundSecondary,
                  opacity: selectedTip && !sendingTip ? 1 : 0.5,
                },
              ]}
            >
              <Feather name="gift" size={18} color="#FFFFFF" />
              <ThemedText
                type="body"
                style={{
                  color: "#FFFFFF",
                  marginLeft: Spacing.sm,
                  fontWeight: "600",
                }}
              >
                {sendingTip ? "Enviando..." : "Enviar propina"}
              </ThemedText>
            </Pressable>
          </View>
        ) : null}

        {order.status === "delivered" && !(order as any).confirmedByCustomer && user?.role === "customer" ? (
          <Pressable
            onPress={async () => {
              Alert.alert(
                "✅ Confirmar entrega",
                "¿Recibiste tu pedido correctamente?",
                [
                  { text: "Cancelar", style: "cancel" },
                  {
                    text: "Sí, lo recibí",
                    onPress: async () => {
                      try {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        const res = await apiRequest("POST", `/api/fund-release/confirm-delivery`, { orderId: order.id });
                        const data = await res.json();
                        if (data.success) {
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          navigation.replace("Review", {
                            orderId: order.id,
                            businessId: order.businessId,
                            businessName: order.businessName,
                            deliveryPersonId: order.deliveryPersonId,
                          });
                        } else {
                          Alert.alert("Error", data.error || "No se pudo confirmar la entrega");
                        }
                      } catch (error: any) {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                        Alert.alert("Error", error.message || "No se pudo confirmar la entrega");
                      }
                    },
                  },
                ]
              );
            }}
            style={[
              styles.confirmButton,
              { backgroundColor: ComeYaColors.success },
              Shadows.md,
            ]}
          >
            <Feather name="check-circle" size={20} color="#FFFFFF" />
            <ThemedText
              type="body"
              style={{ color: "#FFFFFF", marginLeft: Spacing.sm, fontWeight: "600" }}
            >
              Confirmar que recibí mi pedido
            </ThemedText>
          </Pressable>
        ) : order.status === "delivered" && (order as any).confirmedByCustomer && user?.role === "customer" ? (
          <View style={[styles.confirmButton, { backgroundColor: "#E8F5E9" }]}>
            <Feather name="check-circle" size={20} color="#4CAF50" />
            <ThemedText type="body" style={{ color: "#4CAF50", marginLeft: Spacing.sm, fontWeight: "600" }}>
              Entrega confirmada ✔
            </ThemedText>
          </View>
        ) : null}

        {tipSent ? (
          <View
            style={[styles.tipCard, { backgroundColor: "#E8F5E9" }, Shadows.sm]}
          >
            <View style={styles.tipHeader}>
              <Feather name="check-circle" size={20} color="#4CAF50" />
              <ThemedText
                type="h4"
                style={{ marginLeft: Spacing.sm, color: "#2E7D32" }}
              >
                Propina enviada
              </ThemedText>
            </View>
            <ThemedText type="body" style={{ color: "#4CAF50" }}>
              Tu repartidor recibirá ${selectedTip} EUR
            </ThemedText>
          </View>
        ) : null}

        {order.status !== "cancelled" && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (user?.role === "delivery_driver") {
                // El repartidor va a soporte general, no al reporte de pedido de cliente
                navigation.navigate("Support");
              } else {
                navigation.navigate("ReportIssue", {
                  orderId: order.id,
                  orderNumber: order.id.slice(-6),
                });
              }
            }}
            style={[styles.reportButton, { borderColor: theme.border }]}
          >
            <Feather name="alert-circle" size={18} color={ComeYaColors.warning} />
            <ThemedText
              type="body"
              style={{ marginLeft: Spacing.sm, color: theme.textSecondary }}
            >
              Reportar un problema
            </ThemedText>
          </Pressable>
        )}
      </ScrollView>
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
  notFound: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing["4xl"],
  },
  statusCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  businessRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  businessImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  businessInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  etaContainer: {
    alignItems: "flex-end",
  },
  mapPlaceholder: {
    height: 200,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    overflow: "hidden",
  },
  mapContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  addressCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  addressHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  orderDetails: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.xs,
  },
  totalSection: {
    borderTopWidth: 1,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
  },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
  },
  tipCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.lg,
  },
  tipHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  tipOptions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  tipOption: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tipButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  confirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.lg,
  },
  reportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
  },
});

