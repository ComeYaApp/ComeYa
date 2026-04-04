import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/RootStackNavigator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/query-client';
import { isInCoverageArea, AUTLAN_CENTER } from '@/utils/coverage';
import { checkDuplicateAddress, suggestSimilarAddresses, Address } from '@/utils/addressValidation';
import { useDebounce, usePerformanceMonitor } from '@/hooks/usePerformance';
import { Spacing, BorderRadius, ComeYaColors, Shadows } from '@/constants/theme';
import * as Location from 'expo-location';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'AddAddress'>;

export default function AddAddressScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { user } = useAuth();
  usePerformanceMonitor('AddAddressScreen');

  const existingAddress = (route.params as any)?.address as Partial<Address> | undefined;
  const fromCheckout = Boolean((route.params as any)?.fromCheckout);

  const { data: addressesData } = useQuery<{ addresses: Address[] }>({
    queryKey: ['/api/users', user?.id, 'addresses'],
    enabled: !!user?.id,
  });
  const existingAddresses = addressesData?.addresses || [];

  const [label, setLabel] = useState(existingAddress?.label || '');
  const [street, setStreet] = useState(existingAddress?.street || '');
  const [city, setCity] = useState(existingAddress?.city || 'Soria');
  const [state, setState] = useState(existingAddress?.state || 'España');
  const [zipCode, setZipCode] = useState(existingAddress?.zipCode || '');
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [touched, setTouched] = useState(false);
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(
    existingAddress?.latitude && existingAddress?.longitude
      ? { latitude: existingAddress.latitude, longitude: existingAddress.longitude }
      : null,
  );
  const [duplicateWarning, setDuplicateWarning] = useState<Address | null>(null);
  const [suggestions, setSuggestions] = useState<Address[]>([]);

  const debouncedStreet = useDebounce(street, 300);

  useEffect(() => {
    if (coordinates && street && existingAddresses.length > 0) {
      const duplicate = checkDuplicateAddress(
        { latitude: coordinates.latitude, longitude: coordinates.longitude, street },
        existingAddresses,
      );
      setDuplicateWarning(duplicate);
    } else {
      setDuplicateWarning(null);
    }
  }, [coordinates?.latitude, coordinates?.longitude, street, existingAddresses.length]);

  useEffect(() => {
    if (debouncedStreet.length >= 3 && existingAddresses.length > 0) {
      const similar = suggestSimilarAddresses(debouncedStreet, existingAddresses);
      setSuggestions(similar);
    } else {
      setSuggestions([]);
    }
  }, [debouncedStreet, existingAddresses.length]);

  const handleSuggestionSelect = useCallback((addr: Address) => {
    setStreet(addr.street);
    setLabel(addr.label);
    setCoordinates({ latitude: addr.latitude, longitude: addr.longitude });
    setSuggestions([]);
  }, []);

  const handleSave = async () => {
    setTouched(true);
    setError(null);

    if (!label.trim() || !street.trim()) {
      setError('Por favor completa todos los campos requeridos');
      return;
    }

    const finalCoordinates = coordinates || (Platform.OS === 'web' ? AUTLAN_CENTER : null);

    if (!finalCoordinates) {
      setError('Por favor selecciona la ubicación en el mapa');
      return;
    }

    if (!isInCoverageArea(finalCoordinates.latitude, finalCoordinates.longitude)) {
      setError('La ubicación está fuera de nuestra zona de cobertura');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        label: label.trim(),
        street: street.trim(),
        city: city.trim(),
        state: state.trim(),
        zipCode: zipCode.trim(),
        latitude: finalCoordinates.latitude,
        longitude: finalCoordinates.longitude,
      };

      const response = existingAddress?.id
        ? await apiRequest('PUT', `/api/users/${user?.id}/addresses/${existingAddress.id}`, payload)
        : await apiRequest('POST', `/api/users/${user?.id}/addresses`, payload);

      if (response.ok) {
        const responseData = await response.json().catch(() => ({}));
        const savedId = (responseData as any)?.address?.id || (responseData as any)?.id || existingAddress?.id;
        setSuccess(true);
        setTimeout(() => {
          if (fromCheckout && savedId) {
            navigation.navigate('Checkout' as never, {
              addressRefreshToken: Date.now(),
              selectedAddressId: savedId,
            } as never);
          } else {
            navigation.goBack();
          }
        }, 500);
      } else {
        setError('No se pudo guardar la dirección. Intenta de nuevo.');
      }
    } catch {
      setError('Error de conexión. Verifica tu internet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xl * 2 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Error banner */}
        {error && (
          <View style={[styles.banner, { backgroundColor: ComeYaColors.error + '15', borderColor: ComeYaColors.error + '40' }]}>
            <Feather name="alert-circle" size={16} color={ComeYaColors.error} />
            <ThemedText type="small" style={{ color: ComeYaColors.error, flex: 1, marginLeft: Spacing.sm }}>
              {error}
            </ThemedText>
          </View>
        )}

        {/* Success banner */}
        {success && (
          <View style={[styles.banner, { backgroundColor: ComeYaColors.success + '15', borderColor: ComeYaColors.success + '40' }]}>
            <Feather name="check-circle" size={16} color={ComeYaColors.success} />
            <ThemedText type="small" style={{ color: ComeYaColors.success, flex: 1, marginLeft: Spacing.sm }}>
              {existingAddress?.id ? 'Dirección actualizada' : 'Dirección guardada correctamente'}
            </ThemedText>
          </View>
        )}

        {/* GPS button */}
        <Pressable
          style={[
            styles.gpsButton,
            { backgroundColor: ComeYaColors.primary, opacity: locating ? 0.7 : 1 },
            Shadows.sm,
          ]}
          onPress={async () => {
            setLocating(true);
            setError(null);
            try {
              const { status } = await Location.requestForegroundPermissionsAsync();
              if (status !== 'granted') {
                setError('Se necesita permiso de ubicación para usar el GPS');
                return;
              }
              const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
              const { latitude, longitude } = pos.coords;
              setCoordinates({ latitude, longitude });
              const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
              if (place) {
                const streetParts = [place.street, place.streetNumber].filter(Boolean);
                if (streetParts.length > 0) setStreet(streetParts.join(' '));
                if (place.city) setCity(place.city);
                if (place.region) setState(place.region);
                if (place.postalCode) setZipCode(place.postalCode);
              }
            } catch {
              setError('No se pudo obtener la ubicación. Intenta de nuevo.');
            } finally {
              setLocating(false);
            }
          }}
          disabled={locating}
        >
          {locating
            ? <ActivityIndicator size="small" color="#fff" />
            : <Feather name="navigation" size={18} color="#fff" />}
          <ThemedText type="body" style={{ color: '#fff', fontWeight: '600', marginLeft: Spacing.sm }}>
            {locating ? 'Obteniendo ubicación...' : 'Usar mi ubicación actual'}
          </ThemedText>
        </Pressable>

        <View style={[styles.card, { backgroundColor: theme.card }, Shadows.sm]}>
          <Input
            label="Calle y número *"
            leftIcon="map-pin"
            value={street}
            onChangeText={(t) => { setStreet(t); setError(null); }}
            placeholder="Ej: Calle Allende #123"
            autoCapitalize="words"
            onBlur={() => setTouched(true)}
          />

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <View style={[styles.suggestionsBox, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
                Direcciones similares:
              </ThemedText>
              {suggestions.map((addr) => (
                <Pressable
                  key={addr.id}
                  style={[styles.suggestionItem, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={() => handleSuggestionSelect(addr)}
                >
                  <ThemedText type="small" style={{ color: ComeYaColors.primary, fontWeight: '600' }}>
                    {addr.label}
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 2 }}>
                    {addr.street}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          )}

          {/* Duplicate warning */}
          {duplicateWarning && (
            <View style={[styles.banner, { backgroundColor: ComeYaColors.warning + '15', borderColor: ComeYaColors.warning + '40' }]}>
              <Feather name="alert-triangle" size={16} color={ComeYaColors.warning} />
              <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                <ThemedText type="small" style={{ color: ComeYaColors.warning, fontWeight: '600' }}>
                  Similar a "{duplicateWarning.label}"
                </ThemedText>
                <ThemedText type="caption" style={{ color: ComeYaColors.warning }}>
                  {duplicateWarning.street}
                </ThemedText>
              </View>
            </View>
          )}

          <Input
            label="Etiqueta *"
            leftIcon="tag"
            value={label}
            onChangeText={setLabel}
            placeholder="Casa, Trabajo, etc."
            onBlur={() => setTouched(true)}
            error={touched && !label.trim() ? 'Necesitamos una etiqueta para identificar la dirección' : undefined}
          />

          <Input
            label="Ciudad"
            leftIcon="map"
            value={city}
            onChangeText={setCity}
          />

          <Input
            label="Estado"
            leftIcon="flag"
            value={state}
            onChangeText={setState}
          />

          <Input
            label="Código Postal"
            leftIcon="hash"
            value={zipCode}
            onChangeText={setZipCode}
            placeholder="48900"
            keyboardType="numeric"
          />
        </View>

        {/* Map picker / web notice */}
        {Platform.OS !== 'web' ? (
          <Pressable
            style={[
              styles.mapButton,
              {
                backgroundColor: coordinates ? ComeYaColors.primary + '15' : theme.card,
                borderColor: coordinates ? ComeYaColors.primary : theme.border,
              },
              Shadows.sm,
            ]}
            onPress={() =>
              navigation.navigate('LocationPicker', {
                onLocationSelected: (coords: any, addr: any) => {
                  setCoordinates(coords);
                  if (!street && addr) setStreet(addr);
                },
              })
            }
          >
            <Feather
              name={coordinates ? 'check-circle' : 'map-pin'}
              size={20}
              color={coordinates ? ComeYaColors.primary : theme.textSecondary}
            />
            <ThemedText
              type="body"
              style={{
                marginLeft: Spacing.sm,
                color: coordinates ? ComeYaColors.primary : theme.textSecondary,
                fontWeight: '600',
              }}
            >
              {coordinates ? 'Ubicación seleccionada' : 'Seleccionar en mapa *'}
            </ThemedText>
          </Pressable>
        ) : (
          <View style={[styles.banner, { backgroundColor: ComeYaColors.primary + '10', borderColor: ComeYaColors.primary + '30' }]}>
            <Feather name="globe" size={16} color={ComeYaColors.primary} />
            <ThemedText type="small" style={{ color: ComeYaColors.primary, flex: 1, marginLeft: Spacing.sm }}>
              En la versión web se usará la ubicación del centro de Soria por defecto.
            </ThemedText>
          </View>
        )}

        <Button
          onPress={handleSave}
          disabled={loading || success}
          loading={loading}
          style={styles.saveButton}
        >
          {success ? 'Guardado ✓' : existingAddress?.id ? 'Actualizar dirección' : 'Guardar dirección'}
        </Button>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  suggestionsBox: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  suggestionItem: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  saveButton: {
    width: '100%',
  },
});
