import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AUTLAN_CENTER, isInCoverageArea } from '@/utils/coverage';
import { useOptimizedGeocoding } from '@/hooks/usePerformance';

export default function LocationPickerScreen() {
  const navigation = useNavigation();
  const route = useRoute() as any;
  const { reverseGeocode } = useOptimizedGeocoding();

  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') getCurrentLocation();
    else setLocation(AUTLAN_CENTER);
  };

  const getCurrentLocation = async () => {
    try {
      setLoading(true);
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setLocation(coords);
      const result = await reverseGeocode(coords);
      if (result?.formattedAddress) setAddress(result.formattedAddress);
    } catch {
      setLocation(AUTLAN_CENTER);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!location) { Alert.alert('Error', 'Por favor selecciona una ubicación'); return; }
    if (!isInCoverageArea(location.latitude, location.longitude)) {
      Alert.alert('Fuera de cobertura', 'Esta ubicación está fuera de nuestra zona de servicio en San Cristóbal.');
      return;
    }
    if (route.params?.onLocationSelected) route.params.onLocationSelected(location, address);
    navigation.goBack();
  };

  return (
    <View style={s.container}>
      <View style={s.mapPlaceholder}>
        <Text style={s.title}>Selector de Ubicación</Text>
        <Text style={s.subtitle}>En la versión web, usa el botón de abajo para obtener tu ubicación actual.</Text>
        {location && (
          <View style={s.coordBox}>
            <Text style={s.coordText}>📍 {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</Text>
          </View>
        )}
        {address ? <Text style={s.addressText}>{address}</Text> : null}
      </View>

      <View style={s.buttons}>
        <TouchableOpacity style={s.btnSecondary} onPress={getCurrentLocation} disabled={loading}>
          {loading ? <ActivityIndicator color="#007AFF" /> : <Text style={s.btnSecondaryText}>📍 Usar mi ubicación</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[s.btnPrimary, !location && s.btnDisabled]} onPress={handleConfirm} disabled={!location}>
          <Text style={s.btnPrimaryText}>Confirmar Ubicación</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  mapPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  subtitle: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22 },
  coordBox: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginTop: 20 },
  coordText: { fontSize: 13, color: '#333', fontFamily: 'monospace' },
  addressText: { marginTop: 12, fontSize: 14, color: '#555', textAlign: 'center' },
  buttons: { padding: 20, gap: 12 },
  btnSecondary: { backgroundColor: '#fff', padding: 16, borderRadius: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
  btnSecondaryText: { fontSize: 16, color: '#007AFF', fontWeight: '600' },
  btnPrimary: { backgroundColor: '#007AFF', padding: 16, borderRadius: 12, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },
});
