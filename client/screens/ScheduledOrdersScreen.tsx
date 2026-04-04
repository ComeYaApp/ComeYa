import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Colors } from '../constants/Colors';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '@/lib/query-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function ScheduledOrdersScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');

  const { data: scheduledOrders = [], isLoading } = useQuery({
    queryKey: ['scheduled-orders', user?.id],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/scheduled-orders');
      const data = await response.json();
      return data.success ? data.scheduledOrders : [];
    },
    enabled: !!user?.id,
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/scheduled-orders/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-orders'] });
      Alert.alert('Cancelado', 'Pedido cancelado exitosamente');
    },
  });

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('es-VE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      time: date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
    };
  };

  const formatCurrency = (amount: number) => {
    return `€${(amount / 100).toFixed(2)}`;
  };

  const upcomingOrders = scheduledOrders.filter((o: any) => o.status === 'pending');
  const historyOrders = scheduledOrders.filter((o: any) => ['executed', 'cancelled', 'failed'].includes(o.status));

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Cargando pedidos programados...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pedidos Programados</Text>
      
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.activeTabText]}>
            Próximos ({upcomingOrders.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.activeTab]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>
            Historial ({historyOrders.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'upcoming' ? (
          upcomingOrders.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No tienes pedidos programados</Text>
              <Text style={styles.emptySubtitle}>
                Programa tus pedidos favoritos para que lleguen cuando los necesites
              </Text>
            </View>
          ) : (
            upcomingOrders.map((order: any) => {
              const { date, time } = formatDateTime(order.scheduledFor);
              const items = JSON.parse(order.items);
              
              return (
                <View key={order.id} style={styles.orderCard}>
                  <Text style={styles.businessName}>{order.businessName || 'Negocio'}</Text>
                  <Text style={styles.scheduleDate}>📅 {date}</Text>
                  <Text style={styles.scheduleTime}>🕐 {time}</Text>
                  
                  {order.recurringPattern && (
                    <Text style={styles.recurring}>
                      🔄 Se repite {order.recurringPattern}
                    </Text>
                  )}
                  
                  <View style={styles.items}>
                    {items.slice(0, 3).map((item: any, idx: number) => (
                      <Text key={idx} style={styles.item}>
                        {item.quantity}x {item.product?.name || item.name}
                      </Text>
                    ))}
                    {items.length > 3 && (
                      <Text style={styles.moreItems}>+{items.length - 3} más</Text>
                    )}
                  </View>
                  
                  <View style={styles.footer}>
                    <Text style={styles.total}>{formatCurrency(order.total || 0)}</Text>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => {
                        Alert.alert(
                          'Cancelar Pedido',
                          '¿Estás seguro?',
                          [
                            { text: 'No', style: 'cancel' },
                            { text: 'Sí', onPress: () => cancelMutation.mutate(order.id) },
                          ]
                        );
                      }}
                    >
                      <Text style={styles.cancelText}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )
        ) : (
          historyOrders.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Sin historial</Text>
            </View>
          ) : (
            historyOrders.map((order: any) => {
              const { date, time } = formatDateTime(order.scheduledFor);
              
              return (
                <View key={order.id} style={styles.historyCard}>
                  <Text style={styles.businessName}>{order.businessName || 'Negocio'}</Text>
                  <Text style={styles.historyDate}>{date} - {time}</Text>
                  <Text style={[styles.status, { color: order.status === 'executed' ? 'green' : 'red' }]}>
                    {order.status === 'executed' ? 'Completado' : order.status === 'cancelled' ? 'Cancelado' : 'Fallido'}
                  </Text>
                </View>
              );
            })
          )
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', paddingVertical: 20 },
  tabContainer: { flexDirection: 'row', marginHorizontal: 20, backgroundColor: 'white', borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: Colors.light.tint },
  tabText: { fontSize: 14, color: Colors.light.tabIconDefault },
  activeTabText: { color: 'white', fontWeight: '600' },
  content: { flex: 1, padding: 20 },
  emptyState: { alignItems: 'center', padding: 40, backgroundColor: 'white', borderRadius: 12, marginTop: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: Colors.light.tabIconDefault, textAlign: 'center' },
  orderCard: { backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 12 },
  businessName: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  scheduleDate: { fontSize: 14, marginBottom: 4 },
  scheduleTime: { fontSize: 14, marginBottom: 4 },
  recurring: { fontSize: 12, color: Colors.light.tint, fontStyle: 'italic', marginBottom: 8 },
  items: { marginVertical: 8 },
  item: { fontSize: 14, color: Colors.light.tabIconDefault, marginBottom: 2 },
  moreItems: { fontSize: 12, color: Colors.light.tabIconDefault, fontStyle: 'italic' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  total: { fontSize: 18, fontWeight: 'bold', color: Colors.light.tint },
  cancelButton: { backgroundColor: '#FF5252', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  cancelText: { color: 'white', fontSize: 12, fontWeight: '600' },
  historyCard: { backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 12 },
  historyDate: { fontSize: 14, color: Colors.light.tabIconDefault, marginBottom: 4 },
  status: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  loadingText: { fontSize: 18, textAlign: 'center', marginTop: 50 },
});
