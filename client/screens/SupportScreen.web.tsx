import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Text, TextInput, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { apiRequest } from '@/lib/query-client';
import { MobileSidebarWrapper } from '@/components/MobileSidebarWrapper';
import { WebLayout } from '@/components/WebLayout';

const PRIMARY = '#DC2626';

const STATUS_COLOR: Record<string, string> = { open: '#FF9800', in_progress: '#2196F3', resolved: '#4CAF50', closed: '#9E9E9E' };
const STATUS_LABEL: Record<string, string> = { open: 'Abierto', in_progress: 'En proceso', resolved: 'Resuelto', closed: 'Cerrado' };

export default function SupportScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject]   = useState('');
  const [message, setMessage]   = useState('');

  const bg     = isDark ? '#111'    : '#f7f7f7';
  const card   = isDark ? '#1e1e1e' : '#fff';
  const border = isDark ? '#333'    : '#e8e8e8';
  const text   = isDark ? '#fff'    : '#1a1a1a';
  const sub    = isDark ? '#aaa'    : '#666';
  const cardBg = isDark ? '#2a2a2a' : '#f9fafb';

  const { data: ticketsData, isLoading } = useQuery<{ tickets: any[] }>({
    queryKey: ['/api/support/tickets', user?.id],
    enabled: !!user?.id,
  });

  const createMutation = useMutation({
    mutationFn: async () => (await apiRequest('POST', '/api/support/tickets', {
      userId: user?.id, subject, category: 'other', initialMessage: message, priority: 'normal',
    })).json(),
    onSuccess: () => {
      showToast('Ticket creado. Nos pondremos en contacto pronto.', 'success');
      queryClient.invalidateQueries({ queryKey: ['/api/support/tickets'] });
      setShowForm(false); setSubject(''); setMessage('');
    },
    onError: () => showToast('No se pudo crear el ticket', 'error'),
  });

  const handleCreate = () => {
    if (!subject.trim() || !message.trim()) { showToast('Por favor completa todos los campos', 'warning'); return; }
    createMutation.mutate();
  };

  const tickets = ticketsData?.tickets || [];
  const openCount = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;

  return (
    <WebLayout>
    <View style={[s.root, { backgroundColor: bg }]}>
      <MobileSidebarWrapper title="Soporte" sidebarStyle={[s.sidebar, { backgroundColor: card, borderRightColor: border }]}>
        <View style={[s.sideHeader, { borderBottomColor: border }]}>
          <View style={[s.sideIconWrap, { backgroundColor: PRIMARY + '15' }]}>
            <Feather name="help-circle" size={32} color={PRIMARY} />
          </View>
          <Text style={[s.sideTitle, { color: text }]}>Centro de Soporte</Text>
          <Text style={[s.sideSub, { color: sub }]}>{tickets.length} ticket{tickets.length !== 1 ? 's' : ''} en total</Text>
          {openCount > 0 && (
            <View style={[s.openBadge, { backgroundColor: '#FF980020', borderColor: '#FF980040' }]}>
              <View style={[s.dot, { backgroundColor: '#FF9800' }]} />
              <Text style={{ color: '#FF9800', fontSize: 12, fontWeight: '600' }}>{openCount} abierto{openCount !== 1 ? 's' : ''}</Text>
            </View>
          )}
        </View>
        <View style={s.sideNav}>
          <Pressable onPress={() => setShowForm(false)} style={[s.navItem, !showForm && s.navItemActive]}>
            <Feather name="list" size={18} color={!showForm ? PRIMARY : sub} />
            <Text style={[s.navItemText, { color: !showForm ? PRIMARY : text }]}>Mis tickets</Text>
          </Pressable>
          <Pressable onPress={() => setShowForm(true)} style={[s.navItem, showForm && s.navItemActive]}>
            <Feather name="plus-circle" size={18} color={showForm ? PRIMARY : sub} />
            <Text style={[s.navItemText, { color: showForm ? PRIMARY : text }]}>Nuevo ticket</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('SupportChat')} style={s.navItem}>
            <Feather name="message-circle" size={18} color={sub} />
            <Text style={[s.navItemText, { color: text }]}>Chat con IA</Text>
          </Pressable>
        </View>
        <View style={[s.sideFooter, { borderTopColor: border }]}>
          <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
            <Feather name="arrow-left" size={16} color={sub} />
            <Text style={[s.backBtnText, { color: text }]}>Volver</Text>
          </Pressable>
        </View>
      </MobileSidebarWrapper>

      <ScrollView style={s.main} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {showForm ? (
          <>
            <Text style={[s.pageTitle, { color: text }]}>Crear ticket de soporte</Text>

            {/* Chat promo */}
            <Pressable onPress={() => navigation.navigate('SupportChat')}
              style={[s.chatPromo, { backgroundColor: PRIMARY + '10', borderColor: PRIMARY + '30' }]}>
              <View style={[s.chatPromoIcon, { backgroundColor: PRIMARY + '20' }]}>
                <Feather name="zap" size={22} color={PRIMARY} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.chatPromoTitle, { color: PRIMARY }]}>¿Necesitas ayuda inmediata?</Text>
                <Text style={[s.chatPromoSub, { color: sub }]}>Chatea con nuestro asistente IA para respuestas instantáneas</Text>
              </View>
              <Feather name="chevron-right" size={18} color={PRIMARY} />
            </Pressable>

            <View style={[s.formCard, { backgroundColor: card, borderColor: border }]}>
              <Text style={[s.label, { color: sub }]}>Asunto</Text>
              <TextInput value={subject} onChangeText={setSubject} placeholder="Describe brevemente tu problema"
                placeholderTextColor={sub} style={[s.input, { backgroundColor: cardBg, color: text, borderColor: border }]} />
              <Text style={[s.label, { color: sub }]}>Mensaje</Text>
              <TextInput value={message} onChangeText={setMessage} placeholder="Explica tu problema en detalle..."
                placeholderTextColor={sub} multiline numberOfLines={6}
                style={[s.textarea, { backgroundColor: cardBg, color: text, borderColor: border }]} />
              <View style={s.formBtns}>
                <Pressable onPress={() => setShowForm(false)} style={[s.cancelBtn, { borderColor: border }]}>
                  <Text style={[s.cancelBtnText, { color: sub }]}>Cancelar</Text>
                </Pressable>
                <Pressable onPress={handleCreate} disabled={createMutation.isPending}
                  style={[s.submitBtn, { backgroundColor: PRIMARY, opacity: createMutation.isPending ? 0.6 : 1 }]}>
                  {createMutation.isPending
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={s.submitBtnText}>Enviar ticket</Text>
                  }
                </Pressable>
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={s.listHeader}>
              <Text style={[s.pageTitle, { color: text }]}>Mis tickets</Text>
              <Pressable onPress={() => setShowForm(true)} style={[s.newBtn, { backgroundColor: PRIMARY }]}>
                <Feather name="plus" size={16} color="#fff" />
                <Text style={s.newBtnText}>Nuevo ticket</Text>
              </Pressable>
            </View>

            {isLoading ? (
              <View style={s.loadingWrap}><ActivityIndicator size="large" color={PRIMARY} /></View>
            ) : tickets.length === 0 ? (
              <View style={[s.empty, { backgroundColor: card, borderColor: border }]}>
                <Feather name="inbox" size={44} color={sub} />
                <Text style={[s.emptyTitle, { color: text }]}>No tienes tickets</Text>
                <Text style={[s.emptySub, { color: sub }]}>Crea un ticket si necesitas ayuda con tu pedido</Text>
              </View>
            ) : (
              tickets.map(ticket => (
                <Pressable key={ticket.id} onPress={() => navigation.navigate('TicketDetail', { ticketId: ticket.id })}
                  style={[s.ticketCard, { backgroundColor: card, borderColor: border }]}>
                  <View style={s.ticketTop}>
                    <View style={[s.statusBadge, { backgroundColor: (STATUS_COLOR[ticket.status] || '#9E9E9E') + '20' }]}>
                      <View style={[s.dot, { backgroundColor: STATUS_COLOR[ticket.status] || '#9E9E9E' }]} />
                      <Text style={[s.statusText, { color: STATUS_COLOR[ticket.status] || '#9E9E9E' }]}>
                        {STATUS_LABEL[ticket.status] || ticket.status}
                      </Text>
                    </View>
                    <Text style={[s.ticketDate, { color: sub }]}>
                      {new Date(ticket.createdAt).toLocaleDateString('es-ES')}
                    </Text>
                  </View>
                  <Text style={[s.ticketSubject, { color: text }]}>{ticket.subject}</Text>
                  <Text style={[s.ticketCategory, { color: sub }]}>{ticket.category || 'General'}</Text>
                  <Feather name="chevron-right" size={16} color={sub} style={s.ticketArrow} />
                </Pressable>
              ))
            )}
          </>
        )}
      </ScrollView>
    
    </View>
    </WebLayout>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1, flexDirection: 'row', overflow: 'hidden' as any },
  sidebar:       { width: 280, borderRightWidth: 1, flexDirection: 'column' as any },
  sideHeader:    { padding: 24, alignItems: 'center', borderBottomWidth: 1 },
  sideIconWrap:  { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  sideTitle:     { fontSize: 17, fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  sideSub:       { fontSize: 12, textAlign: 'center', marginBottom: 10 },
  openBadge:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  dot:           { width: 7, height: 7, borderRadius: 4 },
  sideNav:       { flex: 1, paddingVertical: 16 },
  navItem:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 20 },
  navItemActive: { backgroundColor: '#DC262610', borderRightWidth: 3, borderRightColor: PRIMARY },
  navItemText:   { fontSize: 14, fontWeight: '600' },
  sideFooter:    { borderTopWidth: 1, padding: 16 },
  backBtn:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  backBtnText:   { fontSize: 14, fontWeight: '600' },
  main:          { flex: 1, height: '100vh' as any },
  content:       { padding: 32, maxWidth: 720, paddingBottom: 80 },
  listHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  pageTitle:     { fontSize: 22, fontWeight: '800', marginBottom: 20 },
  newBtn:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  newBtnText:    { color: '#fff', fontSize: 14, fontWeight: '600' },
  loadingWrap:   { alignItems: 'center', paddingTop: 60 },
  empty:         { borderRadius: 16, borderWidth: 1, padding: 48, alignItems: 'center', gap: 10 },
  emptyTitle:    { fontSize: 18, fontWeight: '700' },
  emptySub:      { fontSize: 14, textAlign: 'center' },
  ticketCard:    { borderRadius: 14, borderWidth: 1, padding: 18, marginBottom: 12, position: 'relative' as any },
  ticketTop:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  statusBadge:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText:    { fontSize: 12, fontWeight: '600' },
  ticketDate:    { fontSize: 12 },
  ticketSubject: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  ticketCategory:{ fontSize: 13 },
  ticketArrow:   { position: 'absolute' as any, right: 18, top: '50%' as any },
  chatPromo:     { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 20 },
  chatPromoIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  chatPromoTitle:{ fontSize: 14, fontWeight: '700', marginBottom: 2 },
  chatPromoSub:  { fontSize: 13 },
  formCard:      { borderRadius: 16, borderWidth: 1, padding: 24 },
  label:         { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 16 },
  input:         { height: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, fontSize: 15 },
  textarea:      { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 15, minHeight: 140, textAlignVertical: 'top' as any },
  formBtns:      { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn:     { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, borderWidth: 1 },
  cancelBtnText: { fontSize: 14, fontWeight: '600' },
  submitBtn:     { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10 },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
