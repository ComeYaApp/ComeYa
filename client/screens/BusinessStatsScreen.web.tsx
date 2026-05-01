import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Text, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { MobileSidebarWrapper } from '@/components/MobileSidebarWrapper';

const PRIMARY = '#DC2626';
type Period = 'today' | 'week' | 'month';

export default function BusinessStatsScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>('week');

  const bg     = isDark ? '#111'    : '#f7f7f7';
  const card   = isDark ? '#1e1e1e' : '#fff';
  const border = isDark ? '#333'    : '#e8e8e8';
  const text   = isDark ? '#fff'    : '#1a1a1a';
  const sub    = isDark ? '#aaa'    : '#666';
  const cardBg = isDark ? '#2a2a2a' : '#f9fafb';

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ['/api/business/stats'],
    enabled: !!user?.id,
  });

  const revenue     = data?.revenue     || { today: 0, week: 0, month: 0, total: 0 };
  const orders      = data?.orders      || { total: 0, completed: 0, cancelled: 0, avgValue: 0 };
  const topProducts = data?.topProducts || [];

  const periodRevenue = { today: revenue.today, week: revenue.week, month: revenue.month }[period] || 0;
  const completionRate = orders.total > 0 ? Math.round((orders.completed / orders.total) * 100) : 100;

  const PERIOD_LABELS: Record<Period, string> = { today: 'Hoy', week: 'Esta semana', month: 'Este mes' };

  const STATS = [
    { icon: 'shopping-bag', label: 'Pedidos totales',  value: orders.total,                          color: '#2196F3' },
    { icon: 'check-circle', label: 'Completados',      value: `${orders.completed} (${completionRate}%)`, color: '#4CAF50' },
    { icon: 'x-circle',     label: 'Cancelados',       value: orders.cancelled,                      color: '#EF4444' },
    { icon: 'dollar-sign',  label: 'Ticket promedio',  value: `€${(orders.avgValue / 100).toFixed(0)}`, color: PRIMARY },
  ];

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <MobileSidebarWrapper title="Estadísticas" sidebarStyle={[s.sidebar, { backgroundColor: card, borderRightColor: border }]}>
        <View style={[s.sideHeader, { borderBottomColor: border }]}>
          <View style={[s.sideIconWrap, { backgroundColor: '#4CAF5015' }]}>
            <Feather name="bar-chart-2" size={32} color="#4CAF50" />
          </View>
          <Text style={[s.sideTitle, { color: text }]}>Estadísticas</Text>
          <Text style={[s.sideSub, { color: sub }]}>Rendimiento de tu negocio</Text>
          <View style={[s.totalBadge, { backgroundColor: '#4CAF5015', borderColor: '#4CAF5030' }]}>
            <Text style={{ color: '#4CAF50', fontSize: 13, fontWeight: '700' }}>
              €{(revenue.total / 100).toFixed(2)} total
            </Text>
          </View>
        </View>
        <View style={s.sideNav}>
          {(['today', 'week', 'month'] as Period[]).map(p => (
            <Pressable key={p} onPress={() => setPeriod(p)} style={[s.navItem, period === p && s.navItemActive]}>
              <Feather name="calendar" size={18} color={period === p ? PRIMARY : sub} />
              <Text style={[s.navItemText, { color: period === p ? PRIMARY : text }]}>{PERIOD_LABELS[p]}</Text>
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
        {isLoading ? (
          <View style={s.loadingWrap}><ActivityIndicator size="large" color={PRIMARY} /></View>
        ) : (
          <>
            {/* Hero ingresos */}
            <View style={[s.heroCard, { backgroundColor: '#4CAF50' }]}>
              <Text style={s.heroLabel}>Ingresos — {PERIOD_LABELS[period]}</Text>
              <Text style={s.heroAmount}>€{(periodRevenue / 100).toFixed(2)}</Text>
              <View style={s.periodRow}>
                {(['today', 'week', 'month'] as Period[]).map(p => (
                  <Pressable key={p} onPress={() => setPeriod(p)}
                    style={[s.periodBtn, { backgroundColor: period === p ? '#fff' : 'rgba(255,255,255,0.2)' }]}>
                    <Text style={[s.periodBtnText, { color: period === p ? '#4CAF50' : '#fff' }]}>{PERIOD_LABELS[p]}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Stats grid */}
            <View style={s.statsGrid}>
              {STATS.map(stat => (
                <View key={stat.label} style={[s.statCard, { backgroundColor: card, borderColor: border }]}>
                  <View style={[s.statIcon, { backgroundColor: stat.color + '20' }]}>
                    <Feather name={stat.icon as any} size={20} color={stat.color} />
                  </View>
                  <Text style={[s.statValue, { color: text }]}>{stat.value}</Text>
                  <Text style={[s.statLabel, { color: sub }]}>{stat.label}</Text>
                </View>
              ))}
            </View>

            {/* Top productos */}
            {topProducts.length > 0 && (
              <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
                <View style={s.cardHeader}>
                  <Feather name="trending-up" size={18} color={PRIMARY} />
                  <Text style={[s.cardTitle, { color: text }]}>Productos más vendidos</Text>
                </View>
                {topProducts.slice(0, 5).map((p: any, i: number) => (
                  <View key={p.name} style={[s.productRow, { borderBottomColor: border, borderBottomWidth: i < 4 ? 1 : 0 }]}>
                    <View style={[s.rankBadge, { backgroundColor: PRIMARY + '20' }]}>
                      <Text style={[s.rankNum, { color: PRIMARY }]}>{i + 1}</Text>
                    </View>
                    <Text style={[s.productName, { color: text }]} numberOfLines={1}>{p.name}</Text>
                    <Text style={[s.productQty, { color: sub }]}>{p.quantity} vendidos</Text>
                    <Text style={[s.productRevenue, { color: '#4CAF50' }]}>€{p.revenue.toFixed(2)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Total histórico */}
            <View style={[s.totalCard, { backgroundColor: card, borderColor: border }]}>
              <View style={s.totalRow}>
                <View>
                  <Text style={[s.totalLabel, { color: sub }]}>Ingresos totales históricos</Text>
                  <Text style={[s.totalAmount, { color: '#4CAF50' }]}>€{(revenue.total / 100).toFixed(2)}</Text>
                </View>
                <View style={[s.totalIcon, { backgroundColor: '#4CAF5020' }]}>
                  <Feather name="bar-chart-2" size={28} color="#4CAF50" />
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1, flexDirection: 'row', overflow: 'hidden' as any },
  sidebar:       { width: 280, borderRightWidth: 1, flexDirection: 'column' as any },
  sideHeader:    { padding: 24, alignItems: 'center', borderBottomWidth: 1 },
  sideIconWrap:  { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  sideTitle:     { fontSize: 17, fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  sideSub:       { fontSize: 12, textAlign: 'center', marginBottom: 10 },
  totalBadge:    { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  sideNav:       { flex: 1, paddingVertical: 16 },
  navItem:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 20 },
  navItemActive: { backgroundColor: '#DC262610', borderRightWidth: 3, borderRightColor: PRIMARY },
  navItemText:   { fontSize: 14, fontWeight: '600' },
  sideFooter:    { borderTopWidth: 1, padding: 16 },
  backBtn:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  backBtnText:   { fontSize: 14, fontWeight: '600' },
  main:          { flex: 1, height: '100vh' as any },
  content:       { padding: 32, maxWidth: 800, paddingBottom: 80 },
  loadingWrap:   { alignItems: 'center', paddingTop: 60 },
  heroCard:      { borderRadius: 20, padding: 32, alignItems: 'center', marginBottom: 24 },
  heroLabel:     { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: 8 },
  heroAmount:    { color: '#fff', fontSize: 52, fontWeight: '900', marginBottom: 20 },
  periodRow:     { flexDirection: 'row', gap: 10 },
  periodBtn:     { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
  periodBtnText: { fontSize: 13, fontWeight: '700' },
  statsGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 20 },
  statCard:      { flex: 1, minWidth: 160, borderRadius: 14, borderWidth: 1, padding: 20, alignItems: 'center', gap: 8 },
  statIcon:      { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  statValue:     { fontSize: 22, fontWeight: '800' },
  statLabel:     { fontSize: 13, textAlign: 'center' },
  card:          { borderRadius: 14, borderWidth: 1, padding: 20, marginBottom: 16 },
  cardHeader:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  cardTitle:     { fontSize: 15, fontWeight: '700' },
  productRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rankBadge:     { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  rankNum:       { fontSize: 14, fontWeight: '800' },
  productName:   { flex: 1, fontSize: 14, fontWeight: '600' },
  productQty:    { fontSize: 13 },
  productRevenue:{ fontSize: 14, fontWeight: '700' },
  totalCard:     { borderRadius: 14, borderWidth: 1, padding: 24 },
  totalRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel:    { fontSize: 14, marginBottom: 4 },
  totalAmount:   { fontSize: 32, fontWeight: '900' },
  totalIcon:     { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
});
