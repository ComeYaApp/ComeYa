import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, ComeYaColors, Shadows } from '@/constants/theme';
import { apiRequest } from '@/lib/query-client';
import { useToast } from '@/contexts/ToastContext';

const PRESET_AMOUNTS = [10, 25, 50, 100];
const PROVIDERS = ['bizum', 'transferencia', 'stripe'];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending_payment:      { label: 'Pendiente de pago',  color: '#F59E0B' },
  pending_verification: { label: 'Verificando pago',   color: '#3B82F6' },
  active:               { label: 'Activa',             color: '#10B981' },
  redeemed:             { label: 'Canjeada',           color: '#6B7280' },
  expired:              { label: 'Expirada',           color: '#EF4444' },
  rejected:             { label: 'Rechazada',          color: '#EF4444' },
};

export default function GiftCardsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [activeTab, setActiveTab]           = useState<'buy' | 'my-cards'>('buy');
  const [amount, setAmount]                 = useState('25');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [message, setMessage]               = useState('');
  const [selectedDesign, setSelectedDesign] = useState('default');

  const [proofCardId, setProofCardId]       = useState<string | null>(null);
  const [proofProvider, setProofProvider]   = useState('bizum');
  const [proofRef, setProofRef]             = useState('');
  const [proofUrl, setProofUrl]             = useState('');

  const { data: designsData } = useQuery({
    queryKey: ['/api/gift-cards/designs'],
    queryFn: async () => (await apiRequest('GET', '/api/gift-cards/designs')).json(),
  });

  const { data: myCardsData, refetch: refetchCards } = useQuery({
    queryKey: ['/api/gift-cards/my-cards'],
    queryFn: async () => (await apiRequest('GET', '/api/gift-cards/my-cards')).json(),
  });

  const purchaseMutation = useMutation({
    mutationFn: async () => (await apiRequest('POST', '/api/gift-cards/purchase', {
      amount: parseFloat(amount),
      recipientEmail: recipientEmail.trim() || undefined,
      message: message.trim() || undefined,
      design: selectedDesign,
    })).json(),
    onSuccess: (data) => {
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast('Gift Card creada. Sube el comprobante de pago.', 'success');
        queryClient.invalidateQueries({ queryKey: ['/api/gift-cards/my-cards'] });
        setProofCardId(data.giftCard.id);
        setActiveTab('my-cards');
        setAmount('25'); setRecipientEmail(''); setMessage('');
      } else {
        showToast(data.error || 'Error al crear gift card', 'error');
      }
    },
  });

  const proofMutation = useMutation({
    mutationFn: async (giftCardId: string) => (await apiRequest('POST', `/api/gift-cards/${giftCardId}/payment-proof`, {
      paymentProvider: proofProvider,
      proofImageUrl: proofUrl.trim(),
      referenceNumber: proofRef.trim() || undefined,
      amount: parseFloat(amount),
    })).json(),
    onSuccess: (data) => {
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast('Comprobante enviado. El admin lo verificará pronto.', 'success');
        setProofCardId(null); setProofRef(''); setProofUrl('');
        refetchCards();
      } else showToast(data.error || 'Error al enviar comprobante', 'error');
    },
  });

  const designs  = designsData?.designs || [];
  const myCards  = myCardsData?.purchased || [];

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h2">Gift Cards</ThemedText>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.tabs}>
        {(['buy', 'my-cards'] as const).map((tab) => (
          <Pressable key={tab} onPress={() => { setActiveTab(tab); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            style={[styles.tab, { backgroundColor: activeTab === tab ? ComeYaColors.primary : theme.backgroundSecondary }]}>
            <ThemedText type="caption" style={{ color: activeTab === tab ? '#fff' : theme.text, fontWeight: activeTab === tab ? '600' : '400' }}>
              {tab === 'buy' ? 'Comprar' : 'Mis Tarjetas'}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {activeTab === 'buy' ? (
          <View>
            {/* Info */}
            <View style={[styles.section, { backgroundColor: '#3B82F615', flexDirection: 'row', gap: 8 }]}>
              <Feather name="info" size={15} color="#3B82F6" />
              <ThemedText type="caption" style={{ color: '#3B82F6', flex: 1 }}>
                Tras crear la gift card, sube el comprobante de pago. El admin la activará en breve.
              </ThemedText>
            </View>

            {/* Monto */}
            <View style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}>
              <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>Monto</ThemedText>
              <View style={styles.amountGrid}>
                {PRESET_AMOUNTS.map((preset) => (
                  <Pressable key={preset} onPress={() => { setAmount(preset.toString()); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                    style={[styles.amountButton, { backgroundColor: amount === preset.toString() ? ComeYaColors.primary : theme.backgroundSecondary, borderColor: amount === preset.toString() ? ComeYaColors.primary : theme.border }]}>
                    <ThemedText type="body" style={{ color: amount === preset.toString() ? '#fff' : theme.text, fontWeight: '600' }}>€{preset}</ThemedText>
                  </Pressable>
                ))}
              </View>
              <TextInput value={amount} onChangeText={setAmount} placeholder="Monto personalizado (mín. €10)"
                placeholderTextColor={theme.textSecondary} keyboardType="numeric"
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} />
            </View>

            {/* Destinatario */}
            <View style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}>
              <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>Para (Opcional)</ThemedText>
              <TextInput value={recipientEmail} onChangeText={setRecipientEmail} placeholder="Email del destinatario"
                placeholderTextColor={theme.textSecondary} keyboardType="email-address" autoCapitalize="none"
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} />
              <TextInput value={message} onChangeText={setMessage} placeholder="Mensaje personalizado"
                placeholderTextColor={theme.textSecondary} multiline numberOfLines={3}
                style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} />
            </View>

            {/* Diseños */}
            {designs.length > 0 && (
              <View style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}>
                <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>Diseño</ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.designsRow}>
                    {designs.map((design: any) => (
                      <Pressable key={design.id} onPress={() => { setSelectedDesign(design.name); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                        style={[styles.designCard, { borderColor: selectedDesign === design.name ? ComeYaColors.primary : theme.border, borderWidth: selectedDesign === design.name ? 3 : 1 }]}>
                        <Image source={{ uri: design.imageUrl }} style={styles.designImage} contentFit="cover" />
                        <ThemedText type="caption" style={{ marginTop: 4, textAlign: 'center' }}>{design.name}</ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            <Pressable onPress={() => purchaseMutation.mutate()}
              disabled={!amount || parseFloat(amount) < 10 || purchaseMutation.isPending}
              style={[styles.purchaseButton, { backgroundColor: ComeYaColors.primary, opacity: amount && parseFloat(amount) >= 10 && !purchaseMutation.isPending ? 1 : 0.5 }, Shadows.md]}>
              <Feather name="gift" size={20} color="#fff" />
              <ThemedText type="body" style={{ color: '#fff', marginLeft: 8, fontWeight: '600' }}>
                {purchaseMutation.isPending ? 'Creando...' : `Crear Gift Card €${amount}`}
              </ThemedText>
            </Pressable>
          </View>
        ) : (
          <View>
            <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>Mis Tarjetas ({myCards.length})</ThemedText>

            {myCards.map((card: any) => {
              const st = STATUS_LABELS[card.status] || STATUS_LABELS['active'];
              const isProofOpen = proofCardId === card.id;
              return (
                <View key={card.id} style={[styles.cardItem, { backgroundColor: theme.card, borderWidth: card.status === 'pending_payment' ? 1.5 : 0, borderColor: '#F59E0B' }, Shadows.sm]}>
                  <View style={styles.cardRow}>
                    <View style={[styles.cardIcon, { backgroundColor: st.color + '20' }]}>
                      <Feather name="gift" size={24} color={st.color} />
                    </View>
                    <View style={styles.cardInfo}>
                      <ThemedText type="body" style={{ fontWeight: '600' }}>{card.code}</ThemedText>
                      <View style={{ backgroundColor: st.color + '20', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 2 }}>
                        <ThemedText type="caption" style={{ color: st.color, fontWeight: '700' }}>{st.label}</ThemedText>
                      </View>
                      {card.status === 'active' && (
                        <ThemedText type="caption" style={{ color: theme.textSecondary }}>Saldo: €{card.balance?.toFixed(2)}</ThemedText>
                      )}
                    </View>
                    <ThemedText type="body" style={{ color: ComeYaColors.primary, fontWeight: '700' }}>€{card.amount?.toFixed(2)}</ThemedText>
                  </View>

                  {card.status === 'pending_payment' && (
                    <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 12 }}>
                      <Pressable onPress={() => setProofCardId(isProofOpen ? null : card.id)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F59E0B15', padding: 10, borderRadius: 8 }}>
                        <Feather name="upload" size={14} color="#F59E0B" />
                        <ThemedText type="caption" style={{ color: '#F59E0B', fontWeight: '700' }}>
                          {isProofOpen ? 'Cancelar' : 'Subir comprobante de pago'}
                        </ThemedText>
                      </Pressable>

                      {isProofOpen && (
                        <View style={{ marginTop: 10, gap: 8 }}>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            {PROVIDERS.map(p => (
                              <Pressable key={p} onPress={() => setProofProvider(p)}
                                style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: proofProvider === p ? ComeYaColors.primary : theme.backgroundSecondary }}>
                                <ThemedText type="caption" style={{ color: proofProvider === p ? '#fff' : theme.text, fontWeight: '600' }}>{p}</ThemedText>
                              </Pressable>
                            ))}
                          </View>
                          <TextInput value={proofRef} onChangeText={setProofRef} placeholder="Referencia / nº operación"
                            placeholderTextColor={theme.textSecondary}
                            style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} />
                          <TextInput value={proofUrl} onChangeText={setProofUrl} placeholder="URL del comprobante"
                            placeholderTextColor={theme.textSecondary} autoCapitalize="none"
                            style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} />
                          <Pressable onPress={() => proofMutation.mutate(card.id)}
                            disabled={!proofUrl.trim() || proofMutation.isPending}
                            style={[styles.purchaseButton, { backgroundColor: '#F59E0B', opacity: proofUrl.trim() ? 1 : 0.5 }]}>
                            <Feather name="send" size={16} color="#fff" />
                            <ThemedText type="body" style={{ color: '#fff', marginLeft: 8, fontWeight: '600' }}>
                              {proofMutation.isPending ? 'Enviando...' : 'Enviar comprobante'}
                            </ThemedText>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}

            {myCards.length === 0 && (
              <View style={styles.emptyState}>
                <Feather name="gift" size={48} color={theme.textSecondary} />
                <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>No tienes gift cards aún</ThemedText>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1 },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  backButton:    { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
  tabs:          { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  tab:           { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, alignItems: 'center' },
  scrollView:    { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: Spacing['4xl'] },
  section:       { padding: Spacing.lg, borderRadius: BorderRadius.xl, marginBottom: Spacing.lg },
  amountGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  amountButton:  { flex: 1, minWidth: '45%', paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 2, alignItems: 'center' },
  input:         { borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: 16, marginBottom: Spacing.sm },
  textArea:      { borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: 16, minHeight: 80, textAlignVertical: 'top' },
  designsRow:    { flexDirection: 'row', gap: Spacing.md },
  designCard:    { width: 100, borderRadius: BorderRadius.lg, overflow: 'hidden' },
  designImage:   { width: 100, height: 100, borderRadius: BorderRadius.lg },
  purchaseButton:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.lg, borderRadius: BorderRadius.lg },
  cardItem:      { padding: Spacing.lg, borderRadius: BorderRadius.xl, marginBottom: Spacing.md },
  cardRow:       { flexDirection: 'row', alignItems: 'center' },
  cardIcon:      { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  cardInfo:      { marginLeft: Spacing.md, flex: 1 },
  emptyState:    { alignItems: 'center', paddingVertical: Spacing['4xl'] },
});
