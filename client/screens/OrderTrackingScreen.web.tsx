import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { theme } from '@/constants/theme';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  accepted: 'Aceptado',
  preparing: 'Preparando',
  ready: 'Listo para recoger',
  picked_up: 'Recogido',
  on_the_way: 'En camino',
  delivered: 'Entregado',
};

const STATUS_STEPS = ['pending', 'accepted', 'preparing', 'picked_up', 'on_the_way', 'delivered'];

export default function OrderTrackingScreen() {
  const route = useRoute() as any;
  const navigation = useNavigation();
  const orderId = route.params?.orderId;
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) return;
    const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://comeya-backend.onrender.com';
    fetch(`${backendUrl}/api/orders/${orderId}`)
      .then(r => r.json())
      .then(d => { setOrder(d.order || d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [orderId]);

  const currentStep = order ? STATUS_STEPS.indexOf(order.status) : 0;

  return (
    <ScrollView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <Text style={s.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={s.title}>Seguimiento del Pedido</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <View style={s.content}>
          <View style={s.mapBanner}>
            <Text style={s.mapIcon}>📍</Text>
            <View>
              <Text style={s.mapTitle}>Tracking GPS en vivo</Text>
              <Text style={s.mapSub}>Disponible en la app movil con mapa interactivo</Text>
            </View>
            <View style={s.appBadge}><Text style={s.appBadgeText}>App</Text></View>
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Estado actual</Text>
            <Text style={s.statusBig}>{STATUS_LABELS[order?.status] || order?.status || 'Cargando...'}</Text>
            <View style={s.progressBar}>
              {STATUS_STEPS.map((step, i) => (
                <View key={step} style={[s.progressStep, i <= currentStep && s.progressStepActive]} />
              ))}
            </View>
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Detalles del pedido</Text>
            <Text style={s.detail}>Pedido #{orderId?.slice(-6)}</Text>
            {order?.businessName && <Text style={s.detail}>Negocio: {order.businessName}</Text>}
            {order?.total && <Text style={s.detail}>Total: {(order.total / 100).toFixed(2)}€</Text>}
          </View>

          <View style={s.downloadBanner}>
            <Text style={s.dlTitle}>Para la mejor experiencia</Text>
            <Text style={s.dlSub}>Descarga la app y sigue tu pedido en el mapa en tiempo real</Text>
            <TouchableOpacity style={s.dlBtn}>
              <Text style={s.dlBtnText}>📱 Descargar ComeYa</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F7' },
  header: { backgroundColor: '#fff', padding: 20, paddingTop: 48, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  back: { marginBottom: 8 },
  backText: { color: theme.colors.primary, fontSize: 15, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '800', color: '#1A1A1A' },
  content: { padding: 16, gap: 16 },
  mapBanner: { backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#E0E0E0' },
  mapIcon: { fontSize: 32 },
  mapTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  mapSub: { fontSize: 12, color: '#888', marginTop: 2 },
  appBadge: { marginLeft: 'auto', backgroundColor: theme.colors.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  appBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E0E0E0' },
  cardTitle: { fontSize: 13, fontWeight: '600', color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  statusBig: { fontSize: 22, fontWeight: '800', color: theme.colors.primary, marginBottom: 16 },
  progressBar: { flexDirection: 'row', gap: 4 },
  progressStep: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#E0E0E0' },
  progressStepActive: { backgroundColor: theme.colors.primary },
  detail: { fontSize: 15, color: '#333', marginBottom: 6 },
  downloadBanner: { backgroundColor: theme.colors.primary, borderRadius: 16, padding: 24, alignItems: 'center' },
  dlTitle: { fontSize: 17, fontWeight: '800', color: '#fff', marginBottom: 6 },
  dlSub: { fontSize: 13, color: 'rgba(255,255,255,.8)', textAlign: 'center', marginBottom: 16 },
  dlBtn: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  dlBtnText: { color: theme.colors.primary, fontWeight: '700', fontSize: 15 },
});
