import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Modal, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/query-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '@/navigation/RootStackNavigator';

const PRIMARY = '#DC2626';
type Nav = NativeStackNavigationProp<RootStackParamList>;

const PAYMENT_METHODS = [
  { id: 'stripe_card',  icon: 'credit-card', color: '#635BFF', label: 'Tarjeta',          sub: 'Visa, Mastercard — pago instantáneo',     instant: true },
  { id: 'stripe_bizum', icon: 'smartphone',  color: '#00ADEF', label: 'Bizum (Stripe)',    sub: 'Pago instantáneo desde tu app bancaria',   instant: true },
  { id: 'bizum_manual', icon: 'smartphone',  color: '#00ADEF', label: 'Bizum (manual)',    sub: 'Transferencia + subir comprobante',        instant: false },
  { id: 'sepa',         icon: 'credit-card', color: '#1A56DB', label: 'Transferencia SEPA',sub: 'IBAN — transferencia + subir comprobante', instant: false },
];

export default function SubscriptionScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<'premium' | 'business'>('premium');
  const [paymentModal, setPaymentModal] = useState<{ plan: 'premium' | 'business'; amount: number } | null>(null);

  const { data: subscriptionData } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/subscriptions/my-subscription');
      const data = await response.json();
      return data.success ? data.subscription : null;
    },
    enabled: !!user?.id,
  });

  const { data: plansData } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/subscriptions/plans');
      const data = await response.json();
      return data.success ? data.plans : null;
    },
  });

  const initMutation = useMutation({
    mutationFn: async (plan: 'premium' | 'business') => {
      const response = await apiRequest('POST', '/api/subscriptions/subscribe', {
        plan,
        billingCycle: 'monthly',
      });
      return response.json();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/subscriptions/cancel');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      Alert.alert('Cancelado', 'Tu suscripción ha sido cancelada');
    },
  });

  const currentPlan = subscriptionData?.plan || 'free';
  const isActive = subscriptionData?.status === 'active';
  const isPendingPayment = subscriptionData?.status === 'pending_payment';

  const handleSubscribePress = (plan: 'premium' | 'business') => {
    const amount = plan === 'premium' ? 1500 : 3000;
    setPaymentModal({ plan, amount });
  };

  const handlePaymentMethodSelect = async (methodId: string) => {
    if (!paymentModal) return;
    const { plan, amount } = paymentModal;
    setPaymentModal(null);

    // Crear suscripción en pending_payment
    let subscriptionId: string;
    try {
      const data = await initMutation.mutateAsync(plan);
      if (!data.success || !data.subscriptionId) {
        Alert.alert('Error', data.error || 'No se pudo iniciar la suscripción');
        return;
      }
      subscriptionId = data.subscriptionId;
    } catch {
      Alert.alert('Error', 'No se pudo conectar con el servidor');
      return;
    }

    if (methodId === 'stripe_card' || methodId === 'stripe_bizum') {
      // Pago instantáneo con Stripe
      navigation.navigate('StripePayment', {
        orderId: subscriptionId,
        amount,
        subtotal: amount,
        deliveryFee: 0,
        businessId: '',
        isSubscription: true,
        subscriptionId,
      } as any);
    } else {
      // Pago manual con comprobante
      const paymentMethod = methodId === 'sepa' ? 'sepa' : 'bizum';
      navigation.navigate('PaymentProof', {
        orderId: subscriptionId,
        amount,
        paymentMethod,
        subscriptionId,
      });
    }
  };

  const renderSubscribeButton = (plan: 'premium' | 'business', price: string) => {
    if (currentPlan === plan && isActive) return null;
    if (isPendingPayment) return null;
    return (
      <TouchableOpacity
        style={styles.subscribeButton}
        onPress={() => handleSubscribePress(plan)}
        disabled={initMutation.isPending}
      >
        <Text style={styles.subscribeButtonText}>
          {initMutation.isPending ? 'Procesando...' : `Suscribirme — Pagar ${price}`}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ComeYa Premium</Text>

      <ScrollView style={styles.content}>
        {/* Plan activo */}
        {isActive && currentPlan !== 'free' && (
          <View style={styles.currentPlanCard}>
            <Text style={styles.currentPlanTitle}>Plan Activo</Text>
            <Text style={styles.currentPlanName}>{currentPlan === 'premium' ? 'Premium' : 'Business'}</Text>
            <Text style={styles.currentPlanPrice}>€{plansData?.[currentPlan]?.price / 100}/mes</Text>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() =>
                Alert.alert(
                  'Cancelar Suscripción',
                  '¿Estás seguro? Seguirás teniendo acceso hasta el final del período',
                  [
                    { text: 'No', style: 'cancel' },
                    { text: 'Sí, cancelar', onPress: () => cancelMutation.mutate() },
                  ]
                )
              }
            >
              <Text style={styles.cancelButtonText}>Cancelar Suscripción</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Pago pendiente */}
        {isPendingPayment && (
          <View style={[styles.currentPlanCard, { borderWidth: 2, borderColor: '#F59E0B' }]}>
            <Text style={{ fontSize: 28, textAlign: 'center' }}>⏳</Text>
            <Text style={[styles.currentPlanName, { color: '#F59E0B', marginTop: 8 }]}>Verificando pago</Text>
            <Text style={[styles.currentPlanTitle, { marginTop: 4 }]}>
              Plan {currentPlan === 'premium' ? 'Premium' : 'Business'} — pendiente de activación
            </Text>
            <Text style={{ fontSize: 13, color: '#888', textAlign: 'center', marginTop: 8 }}>
              Recibirás una notificación cuando se active (5-15 min).
            </Text>
          </View>
        )}

        {/* Plan Premium */}
        <TouchableOpacity
          style={[styles.planCard, selectedPlan === 'premium' && styles.planCardSelected]}
          onPress={() => setSelectedPlan('premium')}
          activeOpacity={0.9}
        >
          <LinearGradient colors={['#FF6B6B', '#4ECDC4']} style={styles.planGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Text style={styles.planName}>Premium</Text>
            <Text style={styles.planPrice}>€15/mes</Text>
          </LinearGradient>
          <View style={styles.planBenefits}>
            {['Envío gratis ilimitado', '10% descuento en todos los pedidos', 'Soporte prioritario 24/7', 'Acceso a ofertas exclusivas'].map(b => (
              <View key={b} style={styles.benefit}>
                <Text style={styles.benefitIcon}>✅</Text>
                <Text style={styles.benefitText}>{b}</Text>
              </View>
            ))}
          </View>
          {renderSubscribeButton('premium', '€15')}
        </TouchableOpacity>

        {/* Plan Business */}
        <TouchableOpacity
          style={[styles.planCard, selectedPlan === 'business' && styles.planCardSelected]}
          onPress={() => setSelectedPlan('business')}
          activeOpacity={0.9}
        >
          <LinearGradient colors={['#667eea', '#764ba2']} style={styles.planGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Text style={styles.planName}>Business</Text>
            <Text style={styles.planPrice}>€30/mes</Text>
          </LinearGradient>
          <View style={styles.planBenefits}>
            {['Todo lo de Premium', '15% descuento en todos los pedidos', 'Sin mínimo de pedido', 'Facturación para empresas'].map(b => (
              <View key={b} style={styles.benefit}>
                <Text style={styles.benefitIcon}>✅</Text>
                <Text style={styles.benefitText}>{b}</Text>
              </View>
            ))}
          </View>
          {renderSubscribeButton('business', '€30')}
        </TouchableOpacity>

        <View style={styles.comparisonCard}>
          <Text style={styles.comparisonTitle}>¿Por qué suscribirse?</Text>
          <Text style={styles.comparisonText}>Ahorra hasta €150 al mes en envíos y descuentos</Text>
          <Text style={styles.comparisonText}>Con solo 2 pedidos al mes ya recuperas tu inversión</Text>
          <Text style={styles.comparisonText}>Cancela cuando quieras, sin permanencia</Text>
        </View>
      </ScrollView>

      {/* Modal selector de método de pago */}
      <Modal visible={!!paymentModal} transparent animationType="slide" onRequestClose={() => setPaymentModal(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPaymentModal(null)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>¿Cómo quieres pagar?</Text>
            <Text style={styles.modalSub}>
              Plan {paymentModal?.plan === 'premium' ? 'Premium' : 'Business'} — €{(paymentModal?.amount || 0) / 100}/mes
            </Text>

            {PAYMENT_METHODS.map(m => (
              <TouchableOpacity
                key={m.id}
                style={styles.methodRow}
                onPress={() => handlePaymentMethodSelect(m.id)}
                activeOpacity={0.8}
              >
                <View style={[styles.methodIcon, { backgroundColor: m.color + '18' }]}>
                  <Feather name={m.icon as any} size={22} color={m.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.methodLabel}>{m.label}</Text>
                  <Text style={styles.methodSub}>{m.sub}</Text>
                </View>
                {m.instant && (
                  <View style={styles.instantBadge}>
                    <Text style={styles.instantText}>Instantáneo</Text>
                  </View>
                )}
                <Feather name="chevron-right" size={18} color="#ccc" />
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.modalCancel} onPress={() => setPaymentModal(null)}>
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f7' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', paddingVertical: 20 },
  content: { flex: 1, padding: 20 },
  currentPlanCard: { backgroundColor: 'white', borderRadius: 12, padding: 20, marginBottom: 20, alignItems: 'center' },
  currentPlanTitle: { fontSize: 14, color: '#888', marginBottom: 8 },
  currentPlanName: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  currentPlanPrice: { fontSize: 18, color: PRIMARY, marginBottom: 16 },
  cancelButton: { backgroundColor: '#FF5252', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  cancelButtonText: { color: 'white', fontWeight: '600' },
  planCard: { backgroundColor: 'white', borderRadius: 12, marginBottom: 20, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  planCardSelected: { borderColor: PRIMARY },
  planGradient: { padding: 24, alignItems: 'center' },
  planName: { fontSize: 28, fontWeight: 'bold', color: 'white', marginBottom: 8 },
  planPrice: { fontSize: 32, fontWeight: 'bold', color: 'white' },
  planBenefits: { padding: 20 },
  benefit: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  benefitIcon: { fontSize: 16, marginRight: 12 },
  benefitText: { fontSize: 14, color: '#333', flex: 1 },
  subscribeButton: { backgroundColor: PRIMARY, margin: 20, marginTop: 0, paddingVertical: 16, borderRadius: 8, alignItems: 'center' },
  subscribeButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  comparisonCard: { backgroundColor: 'white', borderRadius: 12, padding: 20, marginTop: 4, marginBottom: 40 },
  comparisonTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  comparisonText: { fontSize: 14, color: '#888', marginBottom: 8 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  modalSub: { fontSize: 14, color: '#888', marginBottom: 20 },
  methodRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 12 },
  methodIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  methodLabel: { fontSize: 15, fontWeight: '600', color: '#111' },
  methodSub: { fontSize: 12, color: '#888', marginTop: 2 },
  instantBadge: { backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  instantText: { fontSize: 11, color: '#065F46', fontWeight: '600' },
  modalCancel: { marginTop: 16, alignItems: 'center', paddingVertical: 12 },
  modalCancelText: { fontSize: 15, color: '#888' },
});
