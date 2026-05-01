import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Text, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { apiRequest } from '@/lib/query-client';
import { MobileSidebarWrapper } from '@/components/MobileSidebarWrapper';

const PRIMARY = '#DC2626';

const PLANS = [
  {
    id: 'premium',
    name: 'Premium',
    price: '€15/mes',
    gradient: ['#FF6B6B', '#4ECDC4'] as [string, string],
    benefits: [
      'Envío gratis ilimitado',
      '10% descuento en todos los pedidos',
      'Soporte prioritario 24/7',
      'Acceso a ofertas exclusivas',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    price: '€30/mes',
    gradient: ['#667eea', '#764ba2'] as [string, string],
    benefits: [
      'Todo lo de Premium',
      '15% descuento en todos los pedidos',
      'Sin mínimo de pedido',
      'Facturación para empresas',
    ],
  },
];

export default function SubscriptionScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<'premium' | 'business'>('premium');

  const bg     = isDark ? '#111'    : '#f7f7f7';
  const card   = isDark ? '#1e1e1e' : '#fff';
  const border = isDark ? '#333'    : '#e8e8e8';
  const text   = isDark ? '#fff'    : '#1a1a1a';
  const sub    = isDark ? '#aaa'    : '#666';
  const cardBg = isDark ? '#2a2a2a' : '#f9fafb';

  const { data: subscriptionData } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/subscriptions/my-subscription');
      const d = await res.json();
      return d.success ? d.subscription : null;
    },
    enabled: !!user?.id,
  });

  const { data: plansData } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/subscriptions/plans');
      const d = await res.json();
      return d.success ? d.plans : null;
    },
  });

  const subscribeMutation = useMutation({
    mutationFn: async (plan: 'premium' | 'business') => {
      const res = await apiRequest('POST', '/api/subscriptions/subscribe', { plan, billingCycle: 'monthly' });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        showToast('¡Suscripción activada!', 'success');
        queryClient.invalidateQueries({ queryKey: ['subscription'] });
      } else {
        showToast(data.error || 'Error al suscribirse', 'error');
      }
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/subscriptions/cancel');
      return res.json();
    },
    onSuccess: () => {
      showToast('Suscripción cancelada', 'success');
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
  });

  const currentPlan = subscriptionData?.plan || 'free';
  const isActive    = subscriptionData?.status === 'active';

  const NAV_ITEMS = [
    { id: 'premium',  label: 'Plan Premium',  icon: 'star'    },
    { id: 'business', label: 'Plan Business', icon: 'briefcase' },
  ];

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      {/* Sidebar */}
      <MobileSidebarWrapper
        title="Suscripciones"
        sidebarStyle={[s.sidebar, { backgroundColor: card, borderRightColor: border }]}
      >
        <View style={[s.sideHeader, { borderBottomColor: border }]}>
          <View style={[s.sideIconWrap, { backgroundColor: PRIMARY + '15' }]}>
            <Feather name="award" size={36} color={PRIMARY} />
          </View>
          <Text style={[s.sideTitle, { color: text }]}>ComeYa Premium</Text>
          <Text style={[s.sideSub, { color: sub }]}>Elige el plan que mejor se adapte a ti</Text>

          {isActive && currentPlan !== 'free' ? (
            <View style={[s.activeBadge, { backgroundColor: '#10B98120', borderColor: '#10B98140' }]}>
              <Feather name="check-circle" size={13} color="#10B981" />
              <Text style={[s.activeBadgeText, { color: '#10B981' }]}>
                Plan {currentPlan === 'premium' ? 'Premium' : 'Business'} activo
              </Text>
            </View>
          ) : (
            <View style={[s.activeBadge, { backgroundColor: cardBg, borderColor: border }]}>
              <Feather name="circle" size={13} color={sub} />
              <Text style={[s.activeBadgeText, { color: sub }]}>Plan gratuito</Text>
            </View>
          )}
        </View>

        <View style={s.sideNav}>
          {NAV_ITEMS.map(item => (
            <Pressable
              key={item.id}
              onPress={() => setSelectedPlan(item.id as any)}
              style={[s.navItem, selectedPlan === item.id && s.navItemActive]}
            >
              <Feather name={item.icon as any} size={18} color={selectedPlan === item.id ? PRIMARY : sub} />
              <Text style={[s.navItemText, { color: selectedPlan === item.id ? PRIMARY : text }]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={[s.sideFooter, { borderTopColor: border }]}>
          <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
            <Feather name="arrow-left" size={16} color={sub} />
            <Text style={[s.backBtnText, { color: text }]}>Volver</Text>
          </Pressable>
        </View>
      </MobileSidebarWrapper>

      {/* Main */}
      <ScrollView style={s.main} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Plan activo banner */}
        {isActive && currentPlan !== 'free' && (
          <View style={[s.currentBanner, { backgroundColor: '#10B98115', borderColor: '#10B98130' }]}>
            <Feather name="check-circle" size={20} color="#10B981" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[s.currentBannerTitle, { color: text }]}>
                Plan {currentPlan === 'premium' ? 'Premium' : 'Business'} activo
              </Text>
              {plansData?.[currentPlan] && (
                <Text style={[s.currentBannerSub, { color: sub }]}>
                  €{(plansData[currentPlan].price / 100).toFixed(2)}/mes
                </Text>
              )}
            </View>
            <Pressable
              onPress={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              style={[s.cancelBannerBtn, { borderColor: '#EF4444' }]}
            >
              {cancelMutation.isPending
                ? <ActivityIndicator size="small" color="#EF4444" />
                : <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '600' }}>Cancelar</Text>
              }
            </Pressable>
          </View>
        )}

        {/* Cards de planes */}
        <View style={s.plansRow}>
          {PLANS.map(plan => {
            const isSelected = selectedPlan === plan.id;
            const isCurrent  = currentPlan === plan.id && isActive;
            return (
              <Pressable
                key={plan.id}
                onPress={() => setSelectedPlan(plan.id as any)}
                style={[s.planCard, { backgroundColor: card, borderColor: isSelected ? PRIMARY : border }]}
              >
                {/* Header con gradiente simulado */}
                <View style={[s.planHeader, { backgroundColor: plan.gradient[0] }]}>
                  {isCurrent && (
                    <View style={s.currentPill}>
                      <Text style={s.currentPillText}>Activo</Text>
                    </View>
                  )}
                  <Text style={s.planName}>{plan.name}</Text>
                  <Text style={s.planPrice}>{plan.price}</Text>
                </View>

                {/* Beneficios */}
                <View style={s.planBody}>
                  {plan.benefits.map((b, i) => (
                    <View key={i} style={s.benefitRow}>
                      <View style={[s.benefitDot, { backgroundColor: PRIMARY }]} />
                      <Text style={[s.benefitText, { color: text }]}>{b}</Text>
                    </View>
                  ))}
                </View>

                {/* CTA */}
                <View style={[s.planFooter, { borderTopColor: border }]}>
                  {isCurrent ? (
                    <View style={[s.ctaBtn, { backgroundColor: '#10B98120' }]}>
                      <Feather name="check" size={16} color="#10B981" />
                      <Text style={{ color: '#10B981', fontWeight: '700', marginLeft: 6 }}>Plan actual</Text>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => subscribeMutation.mutate(plan.id as any)}
                      disabled={subscribeMutation.isPending}
                      style={[s.ctaBtn, { backgroundColor: PRIMARY }]}
                    >
                      {subscribeMutation.isPending
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <>
                            <Feather name="zap" size={16} color="#fff" />
                            <Text style={{ color: '#fff', fontWeight: '700', marginLeft: 6 }}>Suscribirme</Text>
                          </>
                      }
                    </Pressable>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Comparativa */}
        <View style={[s.infoCard, { backgroundColor: card, borderColor: border }]}>
          <View style={s.infoCardHeader}>
            <Feather name="info" size={18} color={PRIMARY} />
            <Text style={[s.infoCardTitle, { color: text }]}>¿Por qué suscribirse?</Text>
          </View>
          <View style={s.infoRow}>
            <Feather name="trending-up" size={15} color="#10B981" />
            <Text style={[s.infoText, { color: sub }]}>Ahorra hasta €150 al mes en envíos y descuentos</Text>
          </View>
          <View style={s.infoRow}>
            <Feather name="package" size={15} color="#10B981" />
            <Text style={[s.infoText, { color: sub }]}>Con solo 2 pedidos al mes ya recuperas tu inversión</Text>
          </View>
          <View style={s.infoRow}>
            <Feather name="shield" size={15} color="#10B981" />
            <Text style={[s.infoText, { color: sub }]}>Cancela cuando quieras, sin permanencia</Text>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:               { flex: 1, flexDirection: 'row', overflow: 'hidden' as any },
  sidebar:            { width: 280, borderRightWidth: 1, flexDirection: 'column' as any },
  sideHeader:         { padding: 24, alignItems: 'center', borderBottomWidth: 1 },
  sideIconWrap:       { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  sideTitle:          { fontSize: 18, fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  sideSub:            { fontSize: 12, textAlign: 'center', marginBottom: 12 },
  activeBadge:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  activeBadgeText:    { fontSize: 12, fontWeight: '600' },
  sideNav:            { flex: 1, paddingVertical: 16 },
  navItem:            { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 20 },
  navItemActive:      { backgroundColor: '#DC262610', borderRightWidth: 3, borderRightColor: PRIMARY },
  navItemText:        { fontSize: 14, fontWeight: '600' },
  sideFooter:         { borderTopWidth: 1, padding: 16 },
  backBtn:            { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  backBtnText:        { fontSize: 14, fontWeight: '600' },
  main:               { flex: 1, height: '100vh' as any },
  content:            { padding: 32, maxWidth: 860, paddingBottom: 80 },
  currentBanner:      { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 24 },
  currentBannerTitle: { fontSize: 15, fontWeight: '700' },
  currentBannerSub:   { fontSize: 13, marginTop: 2 },
  cancelBannerBtn:    { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  plansRow:           { flexDirection: 'row', gap: 20, marginBottom: 24 },
  planCard:           { flex: 1, borderRadius: 16, borderWidth: 2, overflow: 'hidden' as any },
  planHeader:         { padding: 24, alignItems: 'center', position: 'relative' as any },
  currentPill:        { position: 'absolute' as any, top: 12, right: 12, backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  currentPillText:    { color: '#fff', fontSize: 11, fontWeight: '700' },
  planName:           { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 6 },
  planPrice:          { fontSize: 20, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },
  planBody:           { padding: 20, gap: 10 },
  benefitRow:         { flexDirection: 'row', alignItems: 'center', gap: 10 },
  benefitDot:         { width: 7, height: 7, borderRadius: 4 },
  benefitText:        { fontSize: 14, flex: 1 },
  planFooter:         { borderTopWidth: 1, padding: 16 },
  ctaBtn:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 10 },
  infoCard:           { borderRadius: 16, borderWidth: 1, padding: 20, gap: 12 },
  infoCardHeader:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  infoCardTitle:      { fontSize: 16, fontWeight: '700' },
  infoRow:            { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText:           { fontSize: 14, flex: 1 },
});
