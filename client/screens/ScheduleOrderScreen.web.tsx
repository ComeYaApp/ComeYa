import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Text, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { apiRequest } from '@/lib/query-client';
import { MobileSidebarWrapper } from '@/components/MobileSidebarWrapper';
import { RootStackParamList } from '@/navigation/RootStackNavigator';

const PRIMARY = '#DC2626';
type Route = RouteProp<RootStackParamList, 'ScheduleOrder'>;

const DAYS = [
  { id: 0, label: 'Dom' }, { id: 1, label: 'Lun' }, { id: 2, label: 'Mar' },
  { id: 3, label: 'Mié' }, { id: 4, label: 'Jue' }, { id: 5, label: 'Vie' }, { id: 6, label: 'Sáb' },
];

const DAY_FULL: Record<number, string> = { 0: 'Domingo', 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado' };

export default function ScheduleOrderScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const { businessId, businessName, items, subtotal } = route.params || {};

  const minDate = new Date(); minDate.setHours(minDate.getHours() + 1);
  const minDateStr = minDate.toISOString().slice(0, 16);

  const [isRecurring, setIsRecurring]   = useState(false);
  const [scheduledDate, setScheduledDate] = useState(minDateStr);
  const [recurringTime, setRecurringTime] = useState('12:00');
  const [recurringDays, setRecurringDays] = useState<number[]>([]);

  const bg     = isDark ? '#111'    : '#f7f7f7';
  const card   = isDark ? '#1e1e1e' : '#fff';
  const border = isDark ? '#333'    : '#e8e8e8';
  const text   = isDark ? '#fff'    : '#1a1a1a';
  const sub    = isDark ? '#aaa'    : '#666';
  const cardBg = isDark ? '#2a2a2a' : '#f9fafb';

  const toggleDay = (id: number) =>
    setRecurringDays(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);

  const scheduleMutation = useMutation({
    mutationFn: async () => (await apiRequest('POST', '/api/scheduled-orders', {
      userId: user?.id, businessId, items: JSON.stringify(items),
      scheduledDate: new Date(scheduledDate).toISOString(),
    })).json(),
    onSuccess: () => {
      showToast(`Pedido programado para ${new Date(scheduledDate).toLocaleDateString('es-ES')}`, 'success');
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-orders'] });
      navigation.goBack();
    },
    onError: () => showToast('No se pudo programar el pedido', 'error'),
  });

  const recurringMutation = useMutation({
    mutationFn: async () => (await apiRequest('POST', '/api/recurring-orders', {
      userId: user?.id, businessId, items: JSON.stringify(items),
      daysOfWeek: JSON.stringify(recurringDays), scheduledTime: recurringTime,
    })).json(),
    onSuccess: () => {
      const days = recurringDays.sort().map(d => DAY_FULL[d]).join(', ');
      showToast(`Pedido recurrente creado: cada ${days}`, 'success');
      queryClient.invalidateQueries({ queryKey: ['/api/recurring-orders'] });
      navigation.goBack();
    },
    onError: () => showToast('No se pudo crear el pedido recurrente', 'error'),
  });

  const handleSchedule = () => {
    if (isRecurring) {
      if (recurringDays.length === 0) { showToast('Selecciona al menos un día', 'warning'); return; }
      recurringMutation.mutate();
    } else {
      scheduleMutation.mutate();
    }
  };

  const isPending = scheduleMutation.isPending || recurringMutation.isPending;

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <MobileSidebarWrapper title="Programar Pedido" sidebarStyle={[s.sidebar, { backgroundColor: card, borderRightColor: border }]}>
        <View style={[s.sideHeader, { borderBottomColor: border }]}>
          <View style={[s.sideIconWrap, { backgroundColor: PRIMARY + '15' }]}>
            <Feather name="calendar" size={32} color={PRIMARY} />
          </View>
          <Text style={[s.sideTitle, { color: text }]}>{businessName || 'Negocio'}</Text>
          <Text style={[s.sideSub, { color: sub }]}>{items?.length || 0} productos · €{((subtotal || 0) / 100).toFixed(2)}</Text>
          <View style={[s.typeBadge, { backgroundColor: isRecurring ? '#8B5CF620' : PRIMARY + '20', borderColor: isRecurring ? '#8B5CF640' : PRIMARY + '40' }]}>
            <Feather name={isRecurring ? 'repeat' : 'calendar'} size={13} color={isRecurring ? '#8B5CF6' : PRIMARY} />
            <Text style={{ color: isRecurring ? '#8B5CF6' : PRIMARY, fontSize: 12, fontWeight: '600' }}>
              {isRecurring ? 'Recurrente' : 'Una vez'}
            </Text>
          </View>
        </View>
        <View style={s.sideNav}>
          <Pressable onPress={() => setIsRecurring(false)} style={[s.navItem, !isRecurring && s.navItemActive]}>
            <Feather name="calendar" size={18} color={!isRecurring ? PRIMARY : sub} />
            <Text style={[s.navItemText, { color: !isRecurring ? PRIMARY : text }]}>Una vez</Text>
          </Pressable>
          <Pressable onPress={() => setIsRecurring(true)} style={[s.navItem, isRecurring && s.navItemActive]}>
            <Feather name="repeat" size={18} color={isRecurring ? PRIMARY : sub} />
            <Text style={[s.navItemText, { color: isRecurring ? PRIMARY : text }]}>Recurrente</Text>
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

        {/* Resumen del pedido */}
        <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
          <View style={s.cardHeader}>
            <Feather name="shopping-bag" size={18} color={PRIMARY} />
            <Text style={[s.cardTitle, { color: text }]}>Resumen del pedido</Text>
          </View>
          <View style={s.summaryRow}>
            <Text style={[s.summaryLabel, { color: sub }]}>Negocio</Text>
            <Text style={[s.summaryValue, { color: text }]}>{businessName}</Text>
          </View>
          <View style={s.summaryRow}>
            <Text style={[s.summaryLabel, { color: sub }]}>Productos</Text>
            <Text style={[s.summaryValue, { color: text }]}>{items?.length || 0} artículos</Text>
          </View>
          <View style={s.summaryRow}>
            <Text style={[s.summaryLabel, { color: sub }]}>Subtotal</Text>
            <Text style={[s.summaryValue, { color: PRIMARY }]}>€{((subtotal || 0) / 100).toFixed(2)}</Text>
          </View>
        </View>

        {/* Tipo */}
        <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
          <View style={s.cardHeader}>
            <Feather name="settings" size={18} color={PRIMARY} />
            <Text style={[s.cardTitle, { color: text }]}>Tipo de pedido</Text>
          </View>
          <View style={s.toggleRow}>
            {[{ id: false, label: 'Una vez', icon: 'calendar' }, { id: true, label: 'Recurrente', icon: 'repeat' }].map(opt => (
              <Pressable key={String(opt.id)} onPress={() => setIsRecurring(opt.id)}
                style={[s.toggleBtn, { backgroundColor: isRecurring === opt.id ? PRIMARY : cardBg, borderColor: isRecurring === opt.id ? PRIMARY : border }]}>
                <Feather name={opt.icon as any} size={16} color={isRecurring === opt.id ? '#fff' : sub} />
                <Text style={[s.toggleBtnText, { color: isRecurring === opt.id ? '#fff' : text }]}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Fecha/hora o días */}
        {!isRecurring ? (
          <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
            <View style={s.cardHeader}>
              <Feather name="clock" size={18} color={PRIMARY} />
              <Text style={[s.cardTitle, { color: text }]}>Fecha y hora de entrega</Text>
            </View>
            <input
              type="datetime-local"
              value={scheduledDate}
              min={minDateStr}
              onChange={e => setScheduledDate(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: `1px solid ${border}`, fontSize: 15, backgroundColor: cardBg, color: text, outline: 'none' }}
            />
          </View>
        ) : (
          <>
            <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
              <View style={s.cardHeader}>
                <Feather name="calendar" size={18} color={PRIMARY} />
                <Text style={[s.cardTitle, { color: text }]}>Días de la semana</Text>
              </View>
              <View style={s.daysRow}>
                {DAYS.map(day => (
                  <Pressable key={day.id} onPress={() => toggleDay(day.id)}
                    style={[s.dayBtn, { backgroundColor: recurringDays.includes(day.id) ? PRIMARY : cardBg, borderColor: recurringDays.includes(day.id) ? PRIMARY : border }]}>
                    <Text style={[s.dayBtnText, { color: recurringDays.includes(day.id) ? '#fff' : text }]}>{day.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
              <View style={s.cardHeader}>
                <Feather name="clock" size={18} color={PRIMARY} />
                <Text style={[s.cardTitle, { color: text }]}>Hora de entrega</Text>
              </View>
              <input
                type="time"
                value={recurringTime}
                onChange={e => setRecurringTime(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: `1px solid ${border}`, fontSize: 15, backgroundColor: cardBg, color: text, outline: 'none' }}
              />
            </View>
          </>
        )}

        {/* Info */}
        <View style={[s.infoBanner, { backgroundColor: cardBg, borderColor: border }]}>
          <Feather name="info" size={16} color={sub} />
          <Text style={[s.infoText, { color: sub }]}>
            {isRecurring
              ? 'Recibirás una notificación 1 hora antes de cada pedido para confirmar.'
              : 'Tu pedido será procesado automáticamente en la fecha y hora seleccionada.'}
          </Text>
        </View>

        {/* CTA */}
        <Pressable onPress={handleSchedule} disabled={isPending}
          style={[s.ctaBtn, { backgroundColor: PRIMARY, opacity: isPending ? 0.6 : 1 }]}>
          {isPending
            ? <ActivityIndicator color="#fff" />
            : <><Feather name={isRecurring ? 'repeat' : 'calendar'} size={18} color="#fff" /><Text style={s.ctaBtnText}>{isRecurring ? 'Crear pedido recurrente' : 'Programar pedido'}</Text></>
          }
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1, flexDirection: 'row', overflow: 'hidden' as any },
  sidebar:       { width: 280, borderRightWidth: 1, flexDirection: 'column' as any },
  sideHeader:    { padding: 24, alignItems: 'center', borderBottomWidth: 1 },
  sideIconWrap:  { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  sideTitle:     { fontSize: 16, fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  sideSub:       { fontSize: 12, textAlign: 'center', marginBottom: 10 },
  typeBadge:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  sideNav:       { flex: 1, paddingVertical: 16 },
  navItem:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 20 },
  navItemActive: { backgroundColor: '#DC262610', borderRightWidth: 3, borderRightColor: PRIMARY },
  navItemText:   { fontSize: 14, fontWeight: '600' },
  sideFooter:    { borderTopWidth: 1, padding: 16 },
  backBtn:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  backBtnText:   { fontSize: 14, fontWeight: '600' },
  main:          { flex: 1, height: '100vh' as any },
  content:       { padding: 32, maxWidth: 640, paddingBottom: 80 },
  card:          { borderRadius: 14, borderWidth: 1, padding: 20, marginBottom: 16 },
  cardHeader:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  cardTitle:     { fontSize: 15, fontWeight: '700' },
  summaryRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  summaryLabel:  { fontSize: 14 },
  summaryValue:  { fontSize: 14, fontWeight: '600' },
  toggleRow:     { flexDirection: 'row', gap: 12 },
  toggleBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10, borderWidth: 2 },
  toggleBtnText: { fontSize: 14, fontWeight: '600' },
  daysRow:       { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  dayBtn:        { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },
  dayBtnText:    { fontSize: 13, fontWeight: '700' },
  infoBanner:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 20 },
  infoText:      { flex: 1, fontSize: 13, lineHeight: 18 },
  ctaBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 12 },
  ctaBtnText:    { color: '#fff', fontSize: 16, fontWeight: '700' },
});
