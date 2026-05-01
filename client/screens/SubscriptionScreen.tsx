import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/query-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';

const PRIMARY = '#DC2626';

export default function SubscriptionScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<'premium' | 'business'>('premium');

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

  const subscribeMutation = useMutation({
    mutationFn: async (plan: 'premium' | 'business') => {
      const response = await apiRequest('POST', '/api/subscriptions/subscribe', {
        plan,
        billingCycle: 'monthly',
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      Alert.alert('¡Éxito!', 'Te has suscrito exitosamente');
    },
    onError: () => {
      Alert.alert('Error', 'No se pudo procesar la suscripción');
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ComeYa Premium</Text>

      <ScrollView style={styles.content}>
        {/* Plan actual */}
        {isActive && currentPlan !== 'free' && (
          <View style={styles.currentPlanCard}>
            <Text style={styles.currentPlanTitle}>Tu Plan Actual</Text>
            <Text style={styles.currentPlanName}>{currentPlan === 'premium' ? 'Premium' : 'Business'}</Text>
            <Text style={styles.currentPlanPrice}>
              €{plansData?.[currentPlan]?.price / 100}/mes
            </Text>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                Alert.alert(
                  'Cancelar Suscripción',
                  '¿Estás seguro? Seguirás teniendo acceso hasta el final del período',
                  [
                    { text: 'No', style: 'cancel' },
                    { text: 'Sí, cancelar', onPress: () => cancelMutation.mutate() },
                  ]
                );
              }}
            >
              <Text style={styles.cancelButtonText}>Cancelar Suscripción</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Plan Premium */}
        <TouchableOpacity
          style={[styles.planCard, selectedPlan === 'premium' && styles.planCardSelected]}
          onPress={() => setSelectedPlan('premium')}
        >
          <LinearGradient
            colors={['#FF6B6B', '#4ECDC4']}
            style={styles.planGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.planName}>Premium</Text>
            <Text style={styles.planPrice}>€15/mes</Text>
          </LinearGradient>

          <View style={styles.planBenefits}>
            <View style={styles.benefit}>
              <Text style={styles.benefitIcon}>✅</Text>
              <Text style={styles.benefitText}>Envío gratis ilimitado</Text>
            </View>
            <View style={styles.benefit}>
              <Text style={styles.benefitIcon}>✅</Text>
              <Text style={styles.benefitText}>10% descuento en todos los pedidos</Text>
            </View>
            <View style={styles.benefit}>
              <Text style={styles.benefitIcon}>✅</Text>
              <Text style={styles.benefitText}>Soporte prioritario 24/7</Text>
            </View>
            <View style={styles.benefit}>
              <Text style={styles.benefitIcon}>✅</Text>
              <Text style={styles.benefitText}>Acceso a ofertas exclusivas</Text>
            </View>
          </View>

          {currentPlan !== 'premium' && (
            <TouchableOpacity
              style={styles.subscribeButton}
              onPress={() => subscribeMutation.mutate('premium')}
            >
              <Text style={styles.subscribeButtonText}>Suscribirme</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* Plan Business */}
        <TouchableOpacity
          style={[styles.planCard, selectedPlan === 'business' && styles.planCardSelected]}
          onPress={() => setSelectedPlan('business')}
        >
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.planGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.planName}>Business</Text>
            <Text style={styles.planPrice}>€30/mes</Text>
          </LinearGradient>

          <View style={styles.planBenefits}>
            <View style={styles.benefit}>
              <Text style={styles.benefitIcon}>✅</Text>
              <Text style={styles.benefitText}>Todo lo de Premium</Text>
            </View>
            <View style={styles.benefit}>
              <Text style={styles.benefitIcon}>✅</Text>
              <Text style={styles.benefitText}>15% descuento en todos los pedidos</Text>
            </View>
            <View style={styles.benefit}>
              <Text style={styles.benefitIcon}>✅</Text>
              <Text style={styles.benefitText}>Sin mínimo de pedido</Text>
            </View>
            <View style={styles.benefit}>
              <Text style={styles.benefitIcon}>✅</Text>
              <Text style={styles.benefitText}>Facturación para empresas</Text>
            </View>
          </View>

          {currentPlan !== 'business' && (
            <TouchableOpacity
              style={styles.subscribeButton}
              onPress={() => subscribeMutation.mutate('business')}
            >
              <Text style={styles.subscribeButtonText}>Suscribirme</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* Comparación */}
        <View style={styles.comparisonCard}>
          <Text style={styles.comparisonTitle}>¿Por qué Premium?</Text>
          <Text style={styles.comparisonText}>
            Ahorra hasta €150 al mes en envíos y descuentos
          </Text>
          <Text style={styles.comparisonText}>
            Con solo 2 pedidos al mes, ya recuperas tu inversión
          </Text>
        </View>
      </ScrollView>
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
  subscribeButton: { backgroundColor: PRIMARY, margin: 20, paddingVertical: 16, borderRadius: 8, alignItems: 'center' },
  subscribeButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  comparisonCard: { backgroundColor: 'white', borderRadius: 12, padding: 20, marginTop: 20 },
  comparisonTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  comparisonText: { fontSize: 14, color: '#888', marginBottom: 8 },
});
