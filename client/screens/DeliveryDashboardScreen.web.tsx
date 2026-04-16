import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { theme } from '@/constants/theme';

export default function DeliveryDashboardScreen() {
  const navigation = useNavigation();
  return (
    <ScrollView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Panel Repartidor</Text>
      </View>
      <View style={s.content}>
        <View style={s.banner}>
          <Text style={s.bannerIcon}>🛵</Text>
          <Text style={s.bannerTitle}>GPS y navegacion en la app movil</Text>
          <Text style={s.bannerSub}>El panel completo de repartidor con GPS, rutas y asignacion automatica esta disponible en la app movil.</Text>
          <TouchableOpacity style={s.btn}>
            <Text style={s.btnText}>📱 Descargar la app</Text>
          </TouchableOpacity>
        </View>
        <View style={s.card}>
          <Text style={s.cardTitle}>Funciones disponibles en web</Text>
          {['Ver historial de entregas','Consultar ganancias','Ver estadisticas','Gestionar perfil'].map(f => (
            <View key={f} style={s.featureRow}>
              <Text style={s.check}>✓</Text>
              <Text style={s.featureText}>{f}</Text>
            </View>
          ))}
        </View>
        <View style={s.card}>
          <Text style={s.cardTitle}>Solo en la app movil</Text>
          {['GPS y tracking en tiempo real','Navegacion con Google Maps','Recibir pedidos automaticamente','Alertas de proximidad','Foto de prueba de entrega'].map(f => (
            <View key={f} style={s.featureRow}>
              <Text style={s.cross}>✕</Text>
              <Text style={[s.featureText, { color: '#999' }]}>{f}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F7' },
  header: { backgroundColor: '#fff', padding: 20, paddingTop: 48, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  title: { fontSize: 22, fontWeight: '800', color: '#1A1A1A' },
  content: { padding: 16, gap: 16 },
  banner: { backgroundColor: theme.colors.primary, borderRadius: 20, padding: 28, alignItems: 'center' },
  bannerIcon: { fontSize: 48, marginBottom: 12 },
  bannerTitle: { fontSize: 18, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 8 },
  bannerSub: { fontSize: 14, color: 'rgba(255,255,255,.85)', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  btn: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  btnText: { color: theme.colors.primary, fontWeight: '700', fontSize: 15 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E0E0E0' },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#888', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  check: { color: theme.colors.primary, fontWeight: '700', fontSize: 16, width: 20 },
  cross: { color: '#ccc', fontWeight: '700', fontSize: 16, width: 20 },
  featureText: { fontSize: 14, color: '#333' },
});
