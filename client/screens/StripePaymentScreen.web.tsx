import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Pressable, ActivityIndicator, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useTheme } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';
import { useToast } from '@/contexts/ToastContext';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/query-client';
import { ComeYaLogo } from '@/components/ComeYaLogo';

const PRIMARY = '#DC2626';

let stripePromise: Promise<any> | null = null;
const getStripePromise = async () => {
  if (!stripePromise) {
    try {
      const res = await apiRequest('GET', '/api/stripe/publishable-key');
      const data = await res.json();
      if (data.publishableKey) stripePromise = loadStripe(data.publishableKey);
    } catch {}
  }
  return stripePromise;
};

function PaymentForm({ orderId, amount, businessId, subtotal, deliveryFee, isSubscription, subscriptionId, isGiftCard, onSuccess, onCancel }: any) {
  const stripe = useStripe();
  const elements = useElements();
  const { isDark } = useTheme();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const text   = isDark ? '#fff'    : '#1a1a1a';
  const inputBg = isDark ? '#2a2a2a' : '#f9fafb';
  const border  = isDark ? '#333'   : '#e5e7eb';

  useEffect(() => {
    const init = async () => {
      try {
        console.log('[Stripe] Init params:', { orderId, amount, businessId, isSubscription, subscriptionId, isGiftCard });
        if (!isSubscription && (!orderId || !amount || amount <= 0 || !businessId)) {
          showToast('Datos de pago incompletos', 'error');
          return;
        }
        if (isSubscription && (!subscriptionId || !amount || amount <= 0)) {
          showToast('Datos de suscripción incompletos', 'error');
          return;
        }
        const endpoint = isSubscription
          ? '/api/stripe/create-subscription-payment-intent'
          : '/api/stripe/create-payment-intent';
        const body = isSubscription
          ? { subscriptionId, amount }
          : { orderId, amount: Math.round(amount), businessId, subtotal: Math.round(subtotal || 0), deliveryFee: Math.round(deliveryFee || 0), isGiftCard: !!isGiftCard, isSubscription: !!isSubscription };
        const res = await apiRequest('POST', endpoint, body);
        const data = await res.json();
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
        } else {
          console.error('[Stripe] No clientSecret:', data);
          showToast(data.message || data.error || 'Error al inicializar el pago', 'error');
        }
      } catch (e: any) {
        showToast('Error al conectar con el servidor de pagos', 'error');
      }
    };
    init();
  }, []);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!stripe || !elements || !clientSecret) return;
    setLoading(true);
    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) throw new Error('Card element not found');
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardElement },
      });
      if (error) {
        showToast(error.message || 'Error al procesar el pago', 'error');
        setLoading(false);
      } else if (paymentIntent?.status === 'succeeded') {
        showToast('¡Pago exitoso!', 'success');
        onSuccess(paymentIntent.id);
      }
    } catch (err: any) {
      showToast('Error al procesar el pago', 'error');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%' }}>
      {/* Card element */}
      <View style={[s.cardWrap, { borderColor: border, backgroundColor: inputBg }]}>
        <CardElement options={{
          style: {
            base: { fontSize: '16px', color: text, '::placeholder': { color: isDark ? '#666' : '#9ca3af' }, backgroundColor: 'transparent' },
            invalid: { color: PRIMARY },
          },
        }} />
      </View>

      {!clientSecret && (
        <View style={[s.infoBox, { backgroundColor: PRIMARY + '10', borderColor: PRIMARY + '30' }]}>
          <ActivityIndicator size="small" color={PRIMARY} />
          <span style={{ color: PRIMARY, marginLeft: 10, fontSize: 14 }}>Inicializando pago seguro...</span>
        </View>
      )}

      <button
        type="submit"
        disabled={!stripe || loading || !clientSecret}
        style={{
          width: '100%', height: 52, backgroundColor: (!stripe || loading || !clientSecret) ? '#f87171' : PRIMARY,
          borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', cursor: (!stripe || loading || !clientSecret) ? 'not-allowed' : 'pointer',
          marginTop: 8, gap: 8,
        }}
      >
        {loading
          ? <ActivityIndicator color="#fff" size="small" />
          : <>
              <Feather name="lock" size={18} color="#fff" />
              <span style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                Pagar €{(amount / 100).toFixed(2)}
              </span>
            </>
        }
      </button>

      <Pressable onPress={onCancel} style={s.cancelBtn}>
        <span style={{ color: isDark ? '#aaa' : '#6b7280', fontSize: 14 }}>Cancelar y volver</span>
      </Pressable>
    </form>
  );
}

export default function StripePaymentScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { isDark } = useTheme();
  const { isMobile } = useResponsive();
  const { clearCart } = useCart();
  const { user } = useAuth();
  const [stripeReady, setStripeReady] = useState(false);

  const params = route.params as any;
  const { orderId, amount, subtotal, deliveryFee, businessId, giftCardId, isGiftCard, isSubscription, subscriptionId } = params || {};

  const bg    = isDark ? '#111'    : '#f7f7f7';
  const card  = isDark ? '#1e1e1e' : '#fff';
  const text  = isDark ? '#fff'    : '#1a1a1a';
  const sub   = isDark ? '#aaa'    : '#666';
  const border = isDark ? '#333'   : '#e8e8e8';

  useEffect(() => { getStripePromise().then(() => setStripeReady(true)); }, []);

  const handleSuccess = async (paymentIntentId?: string) => {
    if (isSubscription && subscriptionId) {
      try { await apiRequest('POST', `/api/stripe/confirm-subscription/${subscriptionId}`, {}); } catch {}
      navigation.reset({ index: 0, routes: [{ name: 'Main' }, { name: 'Subscriptions' }] });
      return;
    }
    if (isGiftCard && giftCardId) {
      try { await apiRequest('POST', `/api/gift-cards/${giftCardId}/stripe-success`, { paymentIntentId }); } catch {}
      navigation.reset({ index: 0, routes: [{ name: 'Main' }, { name: 'GiftCards' }] });
      return;
    }
    await clearCart();
    navigation.reset({ index: 0, routes: [{ name: 'Main' }, { name: 'OrderTracking', params: { orderId } }] });
  };

  const icon = isSubscription ? 'star' : isGiftCard ? 'gift' : 'credit-card';
  const title = isSubscription ? 'Activar suscripción' : isGiftCard ? 'Comprar Gift Card' : 'Pago seguro';
  const subtitle = isSubscription
    ? `Plan ${subscriptionId ? 'Premium/Business' : ''} — €${(amount / 100).toFixed(2)}/mes`
    : `Total a pagar: €${(amount / 100).toFixed(2)}`;

  if (!stripeReady) {
    return (
      <View style={[s.root, { backgroundColor: bg, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <span style={{ color: sub, marginTop: 12, fontSize: 14 }}>Cargando pasarela de pago...</span>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      {/* Navbar */}
      <View style={[s.navbar, { backgroundColor: card, borderBottomColor: border }]}>
        <Pressable onPress={() => navigation.goBack()} style={s.navBack}>
          <Feather name="arrow-left" size={20} color={text} />
        </Pressable>
        <View style={s.navLogo}>
          <View style={[s.navLogoCircle, { backgroundColor: isDark ? '#222' : '#fff', borderWidth: 1, borderColor: border }]}>
            <ComeYaLogo size={20} />
          </View>
          <span style={{ fontSize: 16, fontWeight: '700', color: PRIMARY, marginLeft: 8 }}>ComeYa</span>
        </View>
        <View style={s.navSecurity}>
          <Feather name="lock" size={14} color="#10b981" />
          <span style={{ fontSize: 12, color: '#10b981', marginLeft: 4 }}>Pago seguro</span>
        </View>
      </View>

      <Elements stripe={stripePromise}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.body, isMobile && { flexDirection: 'column' }]}>

          {/* LEFT: resumen */}
          {!isMobile && (
            <View style={[s.left, { backgroundColor: card, borderRightColor: border }]}>
              <View style={[s.iconCircle, { backgroundColor: PRIMARY + '15' }]}>
                <Feather name={icon} size={32} color={PRIMARY} />
              </View>
              <span style={{ fontSize: 22, fontWeight: '800', color: text, marginTop: 16, marginBottom: 8 }}>{title}</span>
              <span style={{ fontSize: 14, color: sub, textAlign: 'center', marginBottom: 32 }}>{subtitle}</span>

              <View style={[s.summaryCard, { backgroundColor: isDark ? '#2a2a2a' : '#f9fafb', borderColor: border }]}>
                <View style={s.summaryRow}>
                  <span style={{ fontSize: 14, color: sub }}>Importe</span>
                  <span style={{ fontSize: 20, fontWeight: '800', color: PRIMARY }}>€{(amount / 100).toFixed(2)}</span>
                </View>
                {!isSubscription && !isGiftCard && (
                  <>
                    <View style={[s.summaryDivider, { backgroundColor: border }]} />
                    <View style={s.summaryRow}>
                      <span style={{ fontSize: 13, color: sub }}>Productos</span>
                      <span style={{ fontSize: 13, color: text }}>€{((subtotal || 0) / 100).toFixed(2)}</span>
                    </View>
                    <View style={s.summaryRow}>
                      <span style={{ fontSize: 13, color: sub }}>Envío</span>
                      <span style={{ fontSize: 13, color: text }}>€{((deliveryFee || 0) / 100).toFixed(2)}</span>
                    </View>
                  </>
                )}
              </View>

              <View style={s.badges}>
                {[['shield', 'SSL 256-bit'], ['check-circle', 'Sin cargos ocultos'], ['refresh-cw', 'Cancelación fácil']].map(([ic, label]) => (
                  <View key={label} style={s.badge}>
                    <Feather name={ic as any} size={14} color="#10b981" />
                    <span style={{ fontSize: 12, color: sub, marginLeft: 6 }}>{label}</span>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* RIGHT: formulario */}
          <View style={[s.right, isMobile && { padding: 20 }]}>
            <View style={[s.formCard, { backgroundColor: card, borderColor: border }, Platform.select({ web: { boxShadow: '0 4px 20px rgba(0,0,0,0.08)' } as any })]}>
              {isMobile && (
                <View style={[s.mobileHeader, { marginBottom: 20 }]}>
                  <Feather name={icon} size={24} color={PRIMARY} />
                  <span style={{ fontSize: 18, fontWeight: '700', color: text, marginLeft: 10 }}>{title}</span>
                </View>
              )}

              <span style={{ fontSize: 15, fontWeight: '700', color: text, marginBottom: 16, display: 'block' }}>
                Datos de la tarjeta
              </span>

              <PaymentForm
                orderId={orderId}
                amount={amount}
                businessId={businessId}
                subtotal={subtotal}
                deliveryFee={deliveryFee}
                isSubscription={isSubscription}
                subscriptionId={subscriptionId}
                isGiftCard={isGiftCard}
                onSuccess={handleSuccess}
                onCancel={() => navigation.goBack()}
              />

              <View style={[s.stripeNote, { borderTopColor: border }]}>
                <Feather name="shield" size={13} color={sub} />
                <span style={{ fontSize: 12, color: sub, marginLeft: 6 }}>
                  Procesado por Stripe · Tus datos nunca se almacenan en nuestros servidores
                </span>
              </View>
            </View>
          </View>

        </ScrollView>
      </Elements>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1 },
  navbar:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1 },
  navBack:     { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  navLogo:     { flexDirection: 'row', alignItems: 'center' },
  navLogoCircle: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  navSecurity: { flexDirection: 'row', alignItems: 'center' },
  body:        { flexDirection: 'row', flexGrow: 1 },
  left:        { width: 320, padding: 40, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1 },
  iconCircle:  { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  summaryCard: { width: '100%', borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 24 },
  summaryRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  summaryDivider: { height: 1, marginVertical: 8 },
  badges:      { gap: 10, width: '100%' },
  badge:       { flexDirection: 'row', alignItems: 'center' },
  right:       { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  formCard:    { width: '100%', maxWidth: 480, borderRadius: 16, borderWidth: 1, padding: 32 },
  mobileHeader: { flexDirection: 'row', alignItems: 'center' },
  cardWrap:    { borderWidth: 1.5, borderRadius: 10, padding: 14, marginBottom: 16 },
  infoBox:     { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 16 },
  cancelBtn:   { alignItems: 'center', paddingVertical: 14 },
  stripeNote:  { flexDirection: 'row', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTopWidth: 1 },
});
