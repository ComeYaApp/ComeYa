import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Text, TextInput, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { apiRequest } from '@/lib/query-client';
import { MobileSidebarWrapper } from '@/components/MobileSidebarWrapper';

const PRIMARY = '#DC2626';
const PRESETS = [10, 25, 50, 100];

export default function GiftCardsScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab]       = useState<'buy' | 'my-cards'>('buy');
  const [amount, setAmount]             = useState('25');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [message, setMessage]           = useState('');
  const [selectedDesign, setSelectedDesign] = useState('default');
  const [createdCode, setCreatedCode]   = useState<string | null>(null);

  const bg     = isDark ? '#111'    : '#f7f7f7';
  const card   = isDark ? '#1e1e1e' : '#fff';
  const border = isDark ? '#333'    : '#e8e8e8';
  const text   = isDark ? '#fff'    : '#1a1a1a';
  const sub    = isDark ? '#aaa'    : '#666';
  const cardBg = isDark ? '#2a2a2a' : '#f9fafb';

  const { data: designsData } = useQuery({
    queryKey: ['/api/gift-cards/designs'],
    queryFn: async () => (await apiRequest('GET', '/api/gift-cards/designs')).json(),
  });
  const { data: myCardsData } = useQuery({
    queryKey: ['/api/gift-cards/my-cards'],
    queryFn: async () => (await apiRequest('GET', '/api/gift-cards/my-cards')).json(),
  });

  const purchaseMutation = useMutation({
    mutationFn: async () => (await apiRequest('POST', '/api/gift-cards/purchase', {
      amount: parseFloat(amount), recipientName: recipientName.trim() || undefined,
      recipientEmail: recipientEmail.trim() || undefined, message: message.trim() || undefined,
      design: selectedDesign,
    })).json(),
    onSuccess: (data) => {
      if (data.success) {
        setCreatedCode(data.giftCard.code);
        showToast('¡Gift Card creada!', 'success');
        queryClient.invalidateQueries({ queryKey: ['/api/gift-cards/my-cards'] });
        setAmount('25'); setRecipientName(''); setRecipientEmail(''); setMessage('');
      } else showToast(data.error || 'Error al crear gift card', 'error');
    },
  });

  const designs  = designsData?.designs || [];
  const myCards  = myCardsData || { purchased: [], redeemed: [] };
  const canBuy   = !!amount && parseFloat(amount) >= 10 && !purchaseMutation.isPending;

  const TABS = [
    { id: 'buy',      label: 'Comprar',      icon: 'gift'   },
    { id: 'my-cards', label: 'Mis Tarjetas', icon: 'credit-card' },
  ];

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <MobileSidebarWrapper title="Gift Cards" sidebarStyle={[s.sidebar, { backgroundColor: card, borderRightColor: border }]}>
        <View style={[s.sideHeader, { borderBottomColor: border }]}>
          <View style={[s.sideIconWrap, { backgroundColor: PRIMARY + '15' }]}>
            <Feather name="gift" size={32} color={PRIMARY} />
          </View>
          <Text style={[s.sideTitle, { color: text }]}>Gift Cards</Text>
          <Text style={[s.sideSub, { color: sub }]}>Regala experiencias gastronómicas</Text>
          <View style={[s.countBadge, { backgroundColor: cardBg }]}>
            <Text style={[s.countText, { color: text }]}>{myCards.purchased.length} tarjeta{myCards.purchased.length !== 1 ? 's' : ''} comprada{myCards.purchased.length !== 1 ? 's' : ''}</Text>
          </View>
        </View>
        <View style={s.sideNav}>
          {TABS.map(tab => (
            <Pressable key={tab.id} onPress={() => setActiveTab(tab.id as any)}
              style={[s.navItem, activeTab === tab.id && s.navItemActive]}>
              <Feather name={tab.icon as any} size={18} color={activeTab === tab.id ? PRIMARY : sub} />
              <Text style={[s.navItemText, { color: activeTab === tab.id ? PRIMARY : text }]}>{tab.label}</Text>
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

      <ScrollView style={s.main} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'buy' ? (
          <>
            {/* Código creado */}
            {createdCode && (
              <View style={[s.successBanner, { backgroundColor: '#10B98115', borderColor: '#10B98130' }]}>
                <Feather name="check-circle" size={20} color="#10B981" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[s.successTitle, { color: '#10B981' }]}>¡Gift Card creada!</Text>
                  <Text style={[s.successCode, { color: text }]}>Código: {createdCode}</Text>
                </View>
                <Pressable onPress={() => { navigator.clipboard?.writeText(createdCode).catch(() => {}); showToast('Código copiado', 'success'); }}
                  style={[s.copyCodeBtn, { backgroundColor: '#10B98120' }]}>
                  <Feather name="copy" size={15} color="#10B981" />
                </Pressable>
              </View>
            )}

            {/* Monto */}
            <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
              <View style={s.cardHeader}>
                <Feather name="dollar-sign" size={18} color={PRIMARY} />
                <Text style={[s.cardTitle, { color: text }]}>Monto</Text>
              </View>
              <View style={s.presetsRow}>
                {PRESETS.map(p => (
                  <Pressable key={p} onPress={() => setAmount(p.toString())}
                    style={[s.presetBtn, { backgroundColor: amount === p.toString() ? PRIMARY : cardBg, borderColor: amount === p.toString() ? PRIMARY : border }]}>
                    <Text style={[s.presetBtnText, { color: amount === p.toString() ? '#fff' : text }]}>€{p}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput value={amount} onChangeText={setAmount} placeholder="Monto personalizado (mín. €10)"
                placeholderTextColor={sub} keyboardType="numeric"
                style={[s.input, { backgroundColor: cardBg, color: text, borderColor: border }]} />
            </View>

            {/* Destinatario */}
            <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
              <View style={s.cardHeader}>
                <Feather name="user" size={18} color={PRIMARY} />
                <Text style={[s.cardTitle, { color: text }]}>Para (opcional)</Text>
              </View>
              <TextInput value={recipientName} onChangeText={setRecipientName} placeholder="Nombre del destinatario"
                placeholderTextColor={sub} style={[s.input, { backgroundColor: cardBg, color: text, borderColor: border }]} />
              <TextInput value={recipientEmail} onChangeText={setRecipientEmail} placeholder="Email del destinatario"
                placeholderTextColor={sub} keyboardType="email-address" autoCapitalize="none"
                style={[s.input, { backgroundColor: cardBg, color: text, borderColor: border, marginTop: 10 }]} />
              <TextInput value={message} onChangeText={setMessage} placeholder="Mensaje personalizado"
                placeholderTextColor={sub} multiline numberOfLines={3}
                style={[s.textarea, { backgroundColor: cardBg, color: text, borderColor: border, marginTop: 10 }]} />
            </View>

            {/* Diseños */}
            {designs.length > 0 && (
              <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
                <View style={s.cardHeader}>
                  <Feather name="image" size={18} color={PRIMARY} />
                  <Text style={[s.cardTitle, { color: text }]}>Diseño</Text>
                </View>
                <View style={s.designsRow}>
                  {designs.map((d: any) => (
                    <Pressable key={d.id} onPress={() => setSelectedDesign(d.name)}
                      style={[s.designCard, { borderColor: selectedDesign === d.name ? PRIMARY : border, borderWidth: selectedDesign === d.name ? 3 : 1 }]}>
                      <Image source={{ uri: d.imageUrl }} style={s.designImg} contentFit="cover" />
                      <Text style={[s.designName, { color: sub }]}>{d.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* CTA */}
            <Pressable onPress={() => purchaseMutation.mutate()} disabled={!canBuy}
              style={[s.ctaBtn, { backgroundColor: PRIMARY, opacity: canBuy ? 1 : 0.5 }]}>
              {purchaseMutation.isPending
                ? <ActivityIndicator color="#fff" />
                : <><Feather name="gift" size={18} color="#fff" /><Text style={s.ctaBtnText}>Comprar €{amount}</Text></>
              }
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[s.sectionTitle, { color: text }]}>Compradas ({myCards.purchased.length})</Text>
            {myCards.purchased.length === 0 ? (
              <View style={[s.empty, { backgroundColor: card, borderColor: border }]}>
                <Feather name="gift" size={44} color={sub} />
                <Text style={[s.emptyTitle, { color: text }]}>No has comprado gift cards aún</Text>
              </View>
            ) : (
              myCards.purchased.map((c: any) => (
                <View key={c.id} style={[s.giftCardItem, { backgroundColor: card, borderColor: border }]}>
                  <View style={[s.giftCardIcon, { backgroundColor: PRIMARY + '15' }]}>
                    <Feather name="gift" size={22} color={PRIMARY} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={[s.giftCardCode, { color: text }]}>{c.code}</Text>
                    <Text style={[s.giftCardBalance, { color: sub }]}>Saldo: €{c.balance?.toFixed(2)}</Text>
                  </View>
                  <Text style={[s.giftCardAmount, { color: PRIMARY }]}>€{c.amount?.toFixed(2)}</Text>
                  <Pressable onPress={() => { navigator.clipboard?.writeText(c.code).catch(() => {}); showToast('Código copiado', 'success'); }}
                    style={[s.copyBtn, { backgroundColor: cardBg }]}>
                    <Feather name="copy" size={15} color={sub} />
                  </Pressable>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:           { flex: 1, flexDirection: 'row', overflow: 'hidden' as any },
  sidebar:        { width: 280, borderRightWidth: 1, flexDirection: 'column' as any },
  sideHeader:     { padding: 24, alignItems: 'center', borderBottomWidth: 1 },
  sideIconWrap:   { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  sideTitle:      { fontSize: 17, fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  sideSub:        { fontSize: 12, textAlign: 'center', marginBottom: 10 },
  countBadge:     { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  countText:      { fontSize: 12, fontWeight: '600' },
  sideNav:        { flex: 1, paddingVertical: 16 },
  navItem:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 20 },
  navItemActive:  { backgroundColor: '#DC262610', borderRightWidth: 3, borderRightColor: PRIMARY },
  navItemText:    { fontSize: 14, fontWeight: '600' },
  sideFooter:     { borderTopWidth: 1, padding: 16 },
  backBtn:        { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  backBtnText:    { fontSize: 14, fontWeight: '600' },
  main:           { flex: 1, height: '100vh' as any },
  content:        { padding: 32, maxWidth: 720, paddingBottom: 80 },
  successBanner:  { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 16 },
  successTitle:   { fontSize: 14, fontWeight: '700' },
  successCode:    { fontSize: 16, fontWeight: '800', marginTop: 2 },
  copyCodeBtn:    { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  card:           { borderRadius: 14, borderWidth: 1, padding: 20, marginBottom: 16 },
  cardHeader:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  cardTitle:      { fontSize: 15, fontWeight: '700' },
  presetsRow:     { flexDirection: 'row', gap: 10, marginBottom: 12 },
  presetBtn:      { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 2, alignItems: 'center' },
  presetBtnText:  { fontSize: 16, fontWeight: '700' },
  input:          { height: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, fontSize: 15 },
  textarea:       { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 15, minHeight: 80, textAlignVertical: 'top' as any },
  designsRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  designCard:     { width: 110, borderRadius: 10, overflow: 'hidden' as any, alignItems: 'center' },
  designImg:      { width: 110, height: 110, borderRadius: 10 },
  designName:     { fontSize: 11, marginTop: 4, textAlign: 'center' },
  ctaBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 12 },
  ctaBtnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
  sectionTitle:   { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  empty:          { borderRadius: 16, borderWidth: 1, padding: 48, alignItems: 'center', gap: 10 },
  emptyTitle:     { fontSize: 16, fontWeight: '600' },
  giftCardItem:   { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 12 },
  giftCardIcon:   { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  giftCardCode:   { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  giftCardBalance:{ fontSize: 13 },
  giftCardAmount: { fontSize: 18, fontWeight: '800', marginRight: 10 },
  copyBtn:        { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
});
