import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { ComeYaLogo } from '@/components/ComeYaLogo';
import { apiRequest } from '@/lib/query-client';
import { useResponsive } from '@/hooks/useResponsive';
import { useToast } from '@/contexts/ToastContext';
import { useCart } from '@/contexts/CartContext';

const PRIMARY = "#DC2626";

// Cargar Stripe key desde el backend
let stripePromise: Promise<any> | null = null;

const getStripePromise = async () => {
  if (!stripePromise) {
    try {
      const response = await apiRequest('GET', '/api/stripe/publishable-key');
      const data = await response.json();
      if (data.publishableKey) {
        stripePromise = loadStripe(data.publishableKey);
      }
    } catch (error) {
      console.error('Error loading Stripe key:', error);
    }
  }
  return stripePromise;
};

function PaymentForm({ orderId, amount, businessId, subtotal, deliveryFee, onSuccess, onCancel }: any) {
  const stripe = useStripe();
  const elements = useElements();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  useEffect(() => {
    // Crear Payment Intent en el backend
    const createPaymentIntent = async () => {
      try {
        const response = await apiRequest('POST', '/api/stripe/create-payment-intent', {
          orderId,
          amount,
          businessId,
          subtotal,
          deliveryFee,
        });
        const data = await response.json();
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
        } else {
          showToast('Error al inicializar el pago', 'error');
        }
      } catch (error) {
        console.error('Error creating payment intent:', error);
        showToast('Error al conectar con el servidor de pagos', 'error');
      }
    };
    createPaymentIntent();
  }, [orderId, amount, businessId, subtotal, deliveryFee]);

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    if (!stripe || !elements || !clientSecret) {
      return;
    }

    setLoading(true);

    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
        },
      });

      if (error) {
        showToast(error.message || 'Error al procesar el pago', 'error');
        setLoading(false);
      } else if (paymentIntent?.status === 'succeeded') {
        showToast('¡Pago exitoso!', 'success');
        onSuccess();
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      showToast('Error al procesar el pago', 'error');
      setLoading(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: theme.text,
        '::placeholder': {
          color: theme.textSecondary,
        },
        backgroundColor: theme.backgroundSecondary,
      },
      invalid: {
        color: '#DC2626',
      },
    },
  };

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%' }}>
      <View style={styles.stripeContainer}>
        <View style={[styles.stripeElementWrapper, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}>
          <CardElement options={cardElementOptions} />
        </View>
      </View>

      {!clientSecret && (
        <View style={[styles.infoBox, { backgroundColor: PRIMARY + "10", borderColor: PRIMARY + "30" }]}>
          <ActivityIndicator size="small" color={PRIMARY} />
          <ThemedText type="small" style={{ color: PRIMARY, marginLeft: 12 }}>
            Inicializando pago seguro...
          </ThemedText>
        </View>
      )}

      <button
        type="submit"
        disabled={!stripe || loading || !clientSecret}
        style={{
          height: 56,
          backgroundColor: (!stripe || loading || !clientSecret) ? 'rgba(220, 38, 38, 0.6)' : PRIMARY,
          borderRadius: 16,
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 16,
          border: 'none',
          cursor: (!stripe || loading || !clientSecret) ? 'not-allowed' : 'pointer',
          boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)',
          width: '100%',
        }}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" size="small" />
        ) : (
          <>
            <Feather name="lock" size={20} color="#FFF" />
            <span style={{ color: '#FFF', marginLeft: 12, fontWeight: '600', fontSize: 18 }}>
              Pagar €{(amount / 100).toFixed(2)}
            </span>
          </>
        )}
      </button>

      <Pressable onPress={onCancel} style={styles.cancelButton}>
        <ThemedText type="body" style={{ color: theme.textSecondary }}>
          Cancelar y volver
        </ThemedText>
      </Pressable>
    </form>
  );
}

export default function StripePaymentScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme } = useTheme();
  const { clearCart } = useCart();
  const [stripeReady, setStripeReady] = useState(false);
  const { isMobile } = useResponsive();

  const params = route.params as any;
  const { orderId, amount, subtotal, deliveryFee, businessId, giftCardId, isGiftCard } = params || {};

  useEffect(() => {
    getStripePromise().then(() => setStripeReady(true));
  }, []);

  const handleSuccess = async () => {
    if (isGiftCard && giftCardId) {
      // Activar gift card tras pago Stripe confirmado
      try {
        await apiRequest('POST', `/api/gift-cards/${giftCardId}/stripe-success`, {});
      } catch (e) {
        console.error('Error activating gift card:', e);
      }
      navigation.reset({
        index: 0,
        routes: [
          { name: 'Main' as never },
          { name: 'GiftCards' as never },
        ],
      });
      return;
    }
    await clearCart();
    navigation.reset({
      index: 0,
      routes: [
        { name: 'Main' as never },
        { name: 'OrderTracking' as never, params: { orderId } },
      ],
    });
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  if (!stripeReady) {
    return (
      <View style={[styles.webContainer, { backgroundColor: theme.backgroundRoot, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <ThemedText type="body" style={{ marginTop: 16, color: theme.textSecondary }}>
          Cargando pasarela de pago...
        </ThemedText>
      </View>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <ScrollView style={{ flex: 1, backgroundColor: theme.backgroundRoot }} contentContainerStyle={styles.webContainer}>
      {/* LEFT: Hero Section — oculto en móvil */}
      {!isMobile && <View style={styles.heroSection}>
        <View style={styles.heroContent}>
          <Pressable onPress={() => navigation.goBack()} style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <ComeYaLogo size={48} />
            </View>
            <ThemedText type="h2" style={styles.logoText}>ComeYa</ThemedText>
          </Pressable>

          <View style={styles.heroTextContainer}>
            <ThemedText type="h1" style={styles.heroTitle}>
              Pago seguro
            </ThemedText>
            <ThemedText type="body" style={styles.heroSubtitle}>
              Completa tu pago de forma segura con Stripe
            </ThemedText>
          </View>

          <View style={styles.heroCard}>
            <View style={styles.heroCardHeader}>
              <Feather name={isGiftCard ? 'gift' : 'credit-card'} size={24} color={PRIMARY} />
              <ThemedText type="h4" style={{ marginLeft: 12 }}>{isGiftCard ? 'Gift Card' : 'Total a pagar'}</ThemedText>
            </View>
            <View style={styles.heroCardDivider} />
            <ThemedText type="h1" style={{ color: PRIMARY, fontSize: 48, fontWeight: "800" }}>
              €{(amount / 100).toFixed(2)}
            </ThemedText>
          </View>

          <View style={styles.securityBadges}>
            <View style={styles.securityBadge}>
              <Feather name="shield" size={20} color="rgba(255,255,255,0.9)" />
              <ThemedText type="small" style={{ color: "rgba(255,255,255,0.9)", marginLeft: 8 }}>
                Pago 100% seguro
              </ThemedText>
            </View>
            <View style={styles.securityBadge}>
              <Feather name="lock" size={20} color="rgba(255,255,255,0.9)" />
              <ThemedText type="small" style={{ color: "rgba(255,255,255,0.9)", marginLeft: 8 }}>
                Encriptación SSL
              </ThemedText>
            </View>
          </View>
        </View>
      </View>}

      {/* RIGHT: Payment Form */}
      <View style={[styles.formSection, isMobile && { padding: 16, justifyContent: 'flex-start' }]}>
        <View style={[styles.formCard, { backgroundColor: theme.card }, isMobile && { padding: 20, borderRadius: 16 }]}>
          <ThemedText type="h3" style={{ marginBottom: 24 }}>
            Información de pago
          </ThemedText>

          <PaymentForm 
            orderId={orderId}
            amount={amount}
            businessId={businessId}
            subtotal={subtotal}
            deliveryFee={deliveryFee}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </View>
      </View>
      </ScrollView>
    </Elements>
  );
}

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap" as any,
  },
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
    alignItems: "center",
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
    marginBottom: 24,
    width: "100%",
  },
  securityBadges: {
    gap: 16,
  },
  securityBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  formSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 48,
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
  stripeContainer: {
    marginBottom: 24,
    width: '100%',
  },
  stripeElementWrapper: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
    minHeight: 56,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  payButton: {
    height: 56,
    backgroundColor: PRIMARY,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    ...Platform.select({
      web: {
        boxShadow: "0 4px 12px rgba(220, 38, 38, 0.3)",
      },
    }),
  },
  cancelButton: {
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
});
