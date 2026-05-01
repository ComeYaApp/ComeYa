import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Platform, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/RootStackNavigator';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/query-client';
import { ComeYaLogo } from '@/components/ComeYaLogo';
import { useResponsive } from '@/hooks/useResponsive';
import { Spacing, BorderRadius, ComeYaColors } from '@/constants/theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'AddAddress'>;

const PRIMARY = '#DC2626';
const SORIA = { lat: 41.7636, lng: -2.4677 };
const GMAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY || '';

function loadGoogleMaps(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.maps) { resolve(); return; }
    const existing = document.getElementById('gmap-script');
    if (existing) { existing.addEventListener('load', () => resolve()); return; }
    const script = document.createElement('script');
    script.id = 'gmap-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&libraries=places`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

const LABEL_OPTIONS = ['Casa', 'Trabajo', 'Otro'];

export default function AddAddressScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const { user } = useAuth();
  const { isMobile } = useResponsive();

  const existingAddress = (route.params as any)?.address as any;
  const fromCheckout = Boolean((route.params as any)?.fromCheckout);

  const mapRef = useRef<HTMLDivElement>(null);
  const gmap = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const autocompleteRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [mapsReady, setMapsReady] = useState(false);
  const [label, setLabel] = useState(existingAddress?.label || 'Casa');
  const [street, setStreet] = useState(existingAddress?.street || '');
  const [city, setCity] = useState(existingAddress?.city || 'Soria');
  const [zipCode, setZipCode] = useState(existingAddress?.zipCode || '');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number }>({
    lat: existingAddress?.latitude ? parseFloat(existingAddress.latitude) : SORIA.lat,
    lng: existingAddress?.longitude ? parseFloat(existingAddress.longitude) : SORIA.lng,
  });
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Cargar Google Maps con Places
  useEffect(() => {
    loadGoogleMaps().then(() => setMapsReady(true)).catch(console.error);
  }, []);

  // Inicializar mapa + marcador arrastrable + autocomplete
  useEffect(() => {
    if (!mapsReady || !mapRef.current || gmap.current) return;
    const google = (window as any).google;

    gmap.current = new google.maps.Map(mapRef.current, {
      center: coordinates,
      zoom: 16,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'greedy',
    });

    // Marcador arrastrable
    markerRef.current = new google.maps.Marker({
      position: coordinates,
      map: gmap.current,
      draggable: true,
      title: 'Arrastra para ajustar',
      icon: {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48"><circle cx="20" cy="20" r="18" fill="#DC2626" stroke="white" stroke-width="3"/><circle cx="20" cy="20" r="6" fill="white"/><polygon points="14,38 26,38 20,48" fill="#DC2626"/></svg>')}`,
        scaledSize: new google.maps.Size(40, 48),
        anchor: new google.maps.Point(20, 48),
      },
    });

    // Al arrastrar el marcador → geocodificación inversa
    markerRef.current.addListener('dragend', (e: any) => {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setCoordinates({ lat, lng });
      reverseGeocode(lat, lng);
    });

    // Al hacer click en el mapa → mover marcador
    gmap.current.addListener('click', (e: any) => {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      markerRef.current.setPosition(e.latLng);
      setCoordinates({ lat, lng });
      reverseGeocode(lat, lng);
    });

    // Autocomplete en el input de calle
    if (inputRef.current) {
      autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'es' },
        fields: ['geometry', 'address_components', 'formatted_address'],
        bounds: new google.maps.LatLngBounds(
          { lat: 41.72, lng: -2.52 },
          { lat: 41.82, lng: -2.42 }
        ),
        strictBounds: false,
      });

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace();
        if (!place.geometry?.location) return;

        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const pos = { lat, lng };

        setCoordinates(pos);
        gmap.current.panTo(pos);
        gmap.current.setZoom(17);
        markerRef.current.setPosition(pos);

        // Extraer componentes de la dirección
        const components = place.address_components || [];
        const getComp = (type: string) => components.find((c: any) => c.types.includes(type))?.long_name || '';
        const streetNum = getComp('street_number');
        const route = getComp('route');
        const locality = getComp('locality') || getComp('administrative_area_level_2');
        const postal = getComp('postal_code');

        if (route) setStreet(`${route}${streetNum ? ' ' + streetNum : ''}`);
        if (locality) setCity(locality);
        if (postal) setZipCode(postal);
      });
    }
  }, [mapsReady]);

  const reverseGeocode = useCallback((lat: number, lng: number) => {
    const google = (window as any).google;
    if (!google) return;
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
      if (status !== 'OK' || !results[0]) return;
      const components = results[0].address_components || [];
      const getComp = (type: string) => components.find((c: any) => c.types.includes(type))?.long_name || '';
      const streetNum = getComp('street_number');
      const routeName = getComp('route');
      const locality = getComp('locality') || getComp('administrative_area_level_2');
      const postal = getComp('postal_code');
      if (routeName) setStreet(`${routeName}${streetNum ? ' ' + streetNum : ''}`);
      if (locality) setCity(locality);
      if (postal) setZipCode(postal);
    });
  }, []);

  const handleMyLocation = () => {
    setLocating(true);
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const position = { lat, lng };
        setCoordinates(position);
        gmap.current?.panTo(position);
        gmap.current?.setZoom(17);
        markerRef.current?.setPosition(position);
        reverseGeocode(lat, lng);
        setLocating(false);
      },
      () => {
        setError('No se pudo obtener tu ubicación');
        setLocating(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleSave = async () => {
    setError(null);
    if (!label.trim() || !street.trim()) {
      setError('Completa la etiqueta y la calle');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        label: label.trim(),
        street: street.trim(),
        city: city.trim() || 'Soria',
        state: 'España',
        zipCode: zipCode.trim(),
        latitude: coordinates.lat,
        longitude: coordinates.lng,
      };
      const response = existingAddress?.id
        ? await apiRequest('PUT', `/api/users/${user?.id}/addresses/${existingAddress.id}`, payload)
        : await apiRequest('POST', `/api/users/${user?.id}/addresses`, payload);

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        const savedId = (data as any)?.address?.id || (data as any)?.id || existingAddress?.id;
        setSuccess(true);
        setTimeout(() => {
          if (fromCheckout && savedId) {
            navigation.navigate('Checkout' as never, { addressRefreshToken: Date.now(), selectedAddressId: savedId } as never);
          } else {
            navigation.goBack();
          }
        }, 500);
      } else {
        setError('No se pudo guardar la dirección');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#FAFAFA' }} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap' as any }}>
      {/* LEFT: Hero */}
      {!isMobile && (
        <View style={s.hero}>
          <Pressable onPress={() => navigation.goBack()} style={s.logoRow}>
            <View style={s.logoCircle}><ComeYaLogo size={48} /></View>
            <ThemedText type="h2" style={s.logoText}>ComeYa</ThemedText>
          </Pressable>
          <ThemedText type="h1" style={s.heroTitle}>
            {existingAddress?.id ? 'Editar dirección' : 'Nueva dirección'}
          </ThemedText>
          <ThemedText type="body" style={s.heroSub}>
            Mueve el pin en el mapa para ajustar tu ubicación exacta
          </ThemedText>
          <View style={s.heroCard}>
            <Feather name="map-pin" size={20} color={PRIMARY} />
            <ThemedText type="body" style={{ marginLeft: 12, color: '#6B7280', flex: 1 }}>
              Entregamos en toda Soria y alrededores
            </ThemedText>
          </View>
          <View style={s.tipRow}>
            <Feather name="info" size={14} color="rgba(255,255,255,0.8)" />
            <ThemedText type="small" style={{ color: 'rgba(255,255,255,0.8)', marginLeft: 8 }}>
              Escribe tu calle y el mapa se ajustará automáticamente
            </ThemedText>
          </View>
          <View style={s.tipRow}>
            <Feather name="info" size={14} color="rgba(255,255,255,0.8)" />
            <ThemedText type="small" style={{ color: 'rgba(255,255,255,0.8)', marginLeft: 8 }}>
              También puedes arrastrar el pin rojo para precisar
            </ThemedText>
          </View>
        </View>
      )}

      {/* RIGHT: Form + Map */}
      <View style={[s.formSection, isMobile && { padding: 16 }]}>
        <View style={[s.card, isMobile && { padding: 20, borderRadius: 16 }]}>

          {/* Mapa interactivo */}
          <View style={s.mapWrapper}>
            <div ref={mapRef} style={{ width: '100%', height: '100%', borderRadius: 16 } as any} />
            {!mapsReady && (
              <View style={s.mapLoading}>
                <ActivityIndicator color={PRIMARY} />
              </View>
            )}
            {/* Instrucción flotante */}
            <View style={s.mapHint}>
              <Feather name="move" size={13} color="#FFF" />
              <ThemedText type="caption" style={{ color: '#FFF', marginLeft: 6 }}>
                Toca el mapa o arrastra el pin
              </ThemedText>
            </View>
          </View>

          {/* Botón mi ubicación */}
          <Pressable onPress={handleMyLocation} disabled={locating} style={[s.gpsBtn, locating && { opacity: 0.7 }]}>
            {locating
              ? <ActivityIndicator size="small" color="#FFF" />
              : <Feather name="navigation" size={18} color="#FFF" />}
            <ThemedText type="body" style={{ color: '#FFF', fontWeight: '600', marginLeft: 10 }}>
              {locating ? 'Obteniendo ubicación...' : 'Usar mi ubicación actual'}
            </ThemedText>
          </Pressable>

          {/* Calle con autocomplete */}
          <View style={s.fieldGroup}>
            <ThemedText type="body" style={s.label}>Calle y número *</ThemedText>
            <View style={s.inputRow}>
              <Feather name="map-pin" size={18} color="#9CA3AF" style={s.inputIcon} />
              <input
                ref={inputRef}
                type="text"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="Ej: Calle Mayor 12"
                style={inputStyle}
              />
            </View>
          </View>

          {/* Etiqueta */}
          <View style={s.fieldGroup}>
            <ThemedText type="body" style={s.label}>Etiqueta *</ThemedText>
            <View style={s.labelRow}>
              {LABEL_OPTIONS.map((opt) => (
                <Pressable
                  key={opt}
                  onPress={() => setLabel(opt)}
                  style={[s.labelChip, label === opt && s.labelChipActive]}
                >
                  <ThemedText type="small" style={{ color: label === opt ? '#FFF' : '#374151', fontWeight: '600' }}>
                    {opt}
                  </ThemedText>
                </Pressable>
              ))}
              {!LABEL_OPTIONS.includes(label) && (
                <View style={[s.labelChip, s.labelChipActive]}>
                  <ThemedText type="small" style={{ color: '#FFF', fontWeight: '600' }}>{label}</ThemedText>
                </View>
              )}
            </View>
            <View style={[s.inputRow, { marginTop: 8 }]}>
              <Feather name="tag" size={18} color="#9CA3AF" style={s.inputIcon} />
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Casa, Trabajo, etc."
                style={inputStyle}
              />
            </View>
          </View>

          {/* Ciudad y CP en fila */}
          <View style={s.rowFields}>
            <View style={[s.fieldGroup, { flex: 2, marginRight: 12 }]}>
              <ThemedText type="body" style={s.label}>Ciudad</ThemedText>
              <View style={s.inputRow}>
                <Feather name="map" size={18} color="#9CA3AF" style={s.inputIcon} />
                <input type="text" value={city} onChange={(e) => setCity(e.target.value)} style={inputStyle} />
              </View>
            </View>
            <View style={[s.fieldGroup, { flex: 1 }]}>
              <ThemedText type="body" style={s.label}>C.P.</ThemedText>
              <View style={s.inputRow}>
                <input type="text" value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="42001" style={{ ...inputStyle, paddingLeft: 12 }} />
              </View>
            </View>
          </View>

          {/* Coordenadas confirmadas */}
          <View style={s.coordsBadge}>
            <Feather name="check-circle" size={14} color="#059669" />
            <ThemedText type="caption" style={{ color: '#059669', marginLeft: 6 }}>
              Ubicación: {coordinates.lat.toFixed(5)}, {coordinates.lng.toFixed(5)}
            </ThemedText>
          </View>

          {/* Error */}
          {error && (
            <View style={s.errorBanner}>
              <Feather name="alert-circle" size={16} color="#DC2626" />
              <ThemedText type="small" style={{ color: '#DC2626', marginLeft: 8 }}>{error}</ThemedText>
            </View>
          )}

          {/* Guardar */}
          <Pressable onPress={handleSave} disabled={loading || success} style={[s.saveBtn, (loading || success) && { opacity: 0.6 }]}>
            {loading
              ? <ActivityIndicator color="#FFF" size="small" />
              : <ThemedText type="h4" style={{ color: '#FFF', fontWeight: '700' }}>
                  {success ? '✓ Guardado' : existingAddress?.id ? 'Actualizar dirección' : 'Guardar dirección'}
                </ThemedText>
            }
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  height: 46,
  border: 'none',
  outline: 'none',
  fontSize: 15,
  color: '#1F2937',
  backgroundColor: 'transparent',
  paddingLeft: 36,
  width: '100%',
};

const s = StyleSheet.create({
  hero: {
    flex: 1,
    minWidth: 300,
    maxWidth: 520,
    backgroundColor: PRIMARY,
    padding: 48,
    justifyContent: 'center',
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 40 },
  logoCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  logoText: { color: '#FFF', marginLeft: 14, fontSize: 26, fontWeight: '700' },
  heroTitle: { fontSize: 40, fontWeight: '800', color: '#FFF', marginBottom: 12, lineHeight: 48 },
  heroSub: { fontSize: 16, color: 'rgba(255,255,255,0.85)', lineHeight: 24, marginBottom: 32 },
  heroCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 24 },
  tipRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  formSection: { flex: 1, minWidth: 300, justifyContent: 'center', alignItems: 'center', padding: 40 },
  card: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 40,
    ...Platform.select({ web: { boxShadow: '0 4px 24px rgba(0,0,0,0.09)' } }),
  },
  mapWrapper: {
    height: 260,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
    ...Platform.select({ web: { boxShadow: '0 2px 12px rgba(0,0,0,0.12)' } }),
  } as any,
  mapLoading: { position: 'absolute', inset: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.8)', zIndex: 10 } as any,
  mapHint: {
    position: 'absolute',
    bottom: 10,
    left: '50%',
    transform: [{ translateX: -80 }],
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 5,
  } as any,
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 24,
    ...Platform.select({ web: { boxShadow: '0 4px 12px rgba(220,38,38,0.3)' } }),
  },
  fieldGroup: { marginBottom: 20 },
  label: { fontWeight: '600', color: '#374151', marginBottom: 8, fontSize: 14 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    height: 48,
    position: 'relative',
    ...Platform.select({ web: { display: 'flex' } }),
  },
  inputIcon: { position: 'absolute', left: 10, zIndex: 1 },
  labelRow: { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  labelChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  labelChipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  rowFields: { flexDirection: 'row' },
  coordsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 20,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  saveBtn: {
    height: 54,
    backgroundColor: PRIMARY,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({ web: { boxShadow: '0 4px 12px rgba(220,38,38,0.3)' } }),
  },
});
