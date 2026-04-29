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
import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { ThemedText } from '@/components/ThemedText';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/query-client';
import { isInCoverageArea, SORIA_CENTER } from '@/utils/coverage';
import { checkDuplicateAddress, suggestSimilarAddresses, Address } from '@/utils/addressValidation';
import { useDebounce, usePerformanceMonitor } from '@/hooks/usePerformance';
import { Spacing, BorderRadius, ComeYaColors, Shadows } from '@/constants/theme';
import { ComeYaLogo } from '@/components/ComeYaLogo';
import * as Location from 'expo-location';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'AddAddress'>;

const PRIMARY = "#DC2626";

export default function AddAddressScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
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
    existingAddress?.latitude && existingAddress?.longitude &&
    isInCoverageArea(existingAddress.latitude, existingAddress.longitude)
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

    const finalCoordinates = coordinates || (Platform.OS === 'web' ? SORIA_CENTER : null);

    if (!finalCoordinates) {
      setError('Por favor selecciona la ubicación en el mapa');
      return;
    }

    const coordsToValidate = (Platform.OS === 'web' && !coordinates) ? SORIA_CENTER : finalCoordinates;
    if (!isInCoverageArea(coordsToValidate.latitude, coordsToValidate.longitude)) {
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
    <View style={styles.webContainer}>
      {/* LEFT: Hero Section */}
      <View style={styles.heroSection}>
        <View style={styles.heroContent}>
          {/* Logo */}
          <Pressable onPress={() => navigation.goBack()} style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <ComeYaLogo size={48} />
            </View>
            <ThemedText type="h2" style={styles.logoText}>ComeYa</ThemedText>
          </Pressable>

          {/* Headline */}
          <View style={styles.heroTextContainer}>
            <ThemedText type="h1" style={styles.heroTitle}>
              {existingAddress?.id ? 'Editar dirección' : 'Nueva dirección'}
            </ThemedText>
            <ThemedText type="body" style={styles.heroSubtitle}>
              {existingAddress?.id 
                ? 'Actualiza los datos de tu dirección de entrega'
                : 'Agrega una nueva dirección para recibir tus pedidos'}
            </ThemedText>
          </View>

          {/* Info Cards */}
          <View style={styles.heroCard}>
            <View style={styles.heroCardHeader}>
              <Feather name="map-pin" size={24} color={PRIMARY} />
              <ThemedText type="h4" style={{ marginLeft: 12 }}>Zona de cobertura</ThemedText>
            </View>
            <View style={styles.heroCardDivider} />
            <ThemedText type="body" style={{ color: "#6B7280", marginBottom: 16 }}>
              Actualmente entregamos en toda la ciudad de Soria y alrededores.
            </ThemedText>
            <View style={styles.coverageBadge}>
              <Feather name="check-circle" size={16} color="#059669" />
              <ThemedText type="small" style={{ color: "#059669", marginLeft: 8 }}>
                Soria centro y alrededores
              </ThemedText>
            </View>
          </View>

          {/* Tips */}
          <View style={styles.tipsContainer}>
            <View style={styles.tipItem}>
              <Feather name="info" size={16} color="rgba(255,255,255,0.8)" />
              <ThemedText type="small" style={{ color: "rgba(255,255,255,0.8)", marginLeft: 8 }}>
                Asegúrate de incluir el número de portal
              </ThemedText>
            </View>
            <View style={styles.tipItem}>
              <Feather name="info" size={16} color="rgba(255,255,255,0.8)" />
              <ThemedText type="small" style={{ color: "rgba(255,255,255,0.8)", marginLeft: 8 }}>
                Puedes usar el GPS para ubicación exacta
              </ThemedText>
            </View>
          </View>
        </View>
      </View>

      {/* RIGHT: Form Section */}
      <View style={styles.formSection}>
        <ScrollView 
          style={styles.formScrollView}
          contentContainerStyle={styles.formScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formCard}>
            {/* Error banner */}
            {error && (
              <View style={styles.errorBanner}>
                <Feather name="alert-circle" size={20} color="#DC2626" />
                <ThemedText type="body" style={{ color: "#DC2626", flex: 1, marginLeft: 12 }}>
                  {error}
                </ThemedText>
              </View>
            )}

            {/* Success banner */}
            {success && (
              <View style={styles.successBanner}>
                <Feather name="check-circle" size={20} color="#059669" />
                <ThemedText type="body" style={{ color: "#059669", flex: 1, marginLeft: 12 }}>
                  {existingAddress?.id ? 'Dirección actualizada' : 'Dirección guardada correctamente'}
                </ThemedText>
              </View>
            )}

            {/* GPS Button */}
            <Pressable
              style={[styles.gpsButton, locating && { opacity: 0.7 }]}
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
                    if (place.postalCode) setZipCode(place.postalCode);
                    if (place.city) setCity(place.city);
                    if (place.region) setState(place.region);
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
                : <Feather name="navigation" size={20} color="#fff" />}
              <ThemedText type="body" style={{ color: '#fff', fontWeight: '600', marginLeft: 12 }}>
                {locating ? 'Obteniendo ubicación...' : 'Usar mi ubicación actual'}
              </ThemedText>
            </Pressable>

            {/* Street Input */}
            <View style={styles.inputGroup}>
              <ThemedText type="body" style={styles.inputLabel}>
                Calle y número *
              </ThemedText>
              <View style={styles.inputWrapper}>
                <Feather name="map-pin" size={20} color="#6B7280" style={styles.inputIcon} />
                <input
                  type="text"
                  value={street}
                  onChange={(e) => { setStreet(e.target.value); setError(null); }}
                  onBlur={() => setTouched(true)}
                  placeholder="Ej: Calle Mayor 12"
                  style={{
                    flex: 1,
                    height: 48,
                    border: 'none',
                    outline: 'none',
                    fontSize: 16,
                    color: '#1F2937',
                    backgroundColor: 'transparent',
                    paddingLeft: 40,
                  }}
                />
              </View>
            </View>

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <View style={styles.suggestionsBox}>
                <ThemedText type="small" style={{ color: "#6B7280", marginBottom: 12 }}>
                  Direcciones similares:
                </ThemedText>
                {suggestions.map((addr) => (
                  <Pressable
                    key={addr.id}
                    style={styles.suggestionItem}
                    onPress={() => handleSuggestionSelect(addr)}
                  >
                    <ThemedText type="body" style={{ color: PRIMARY, fontWeight: '600', marginBottom: 4 }}>
                      {addr.label}
                    </ThemedText>
                    <ThemedText type="small" style={{ color: "#6B7280" }}>
                      {addr.street}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Duplicate warning */}
            {duplicateWarning && (
              <View style={styles.warningBanner}>
                <Feather name="alert-triangle" size={20} color="#F59E0B" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <ThemedText type="body" style={{ color: "#F59E0B", fontWeight: '600', marginBottom: 4 }}>
                    Similar a "{duplicateWarning.label}"
                  </ThemedText>
                  <ThemedText type="small" style={{ color: "#F59E0B" }}>
                    {duplicateWarning.street}
                  </ThemedText>
                </View>
              </View>
            )}

            {/* Label Input */}
            <View style={styles.inputGroup}>
              <ThemedText type="body" style={styles.inputLabel}>
                Etiqueta *
              </ThemedText>
              <View style={styles.inputWrapper}>
                <Feather name="tag" size={20} color="#6B7280" style={styles.inputIcon} />
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  onBlur={() => setTouched(true)}
                  placeholder="Casa, Trabajo, etc."
                  style={{
                    flex: 1,
                    height: 48,
                    border: 'none',
                    outline: 'none',
                    fontSize: 16,
                    color: '#1F2937',
                    backgroundColor: 'transparent',
                    paddingLeft: 40,
                  }}
                />
              </View>
              {touched && !label.trim() && (
                <ThemedText type="small" style={{ color: "#DC2626", marginTop: 8 }}>
                  Necesitamos una etiqueta para identificar la dirección
                </ThemedText>
              )}
            </View>

            {/* City Input */}
            <View style={styles.inputGroup}>
              <ThemedText type="body" style={styles.inputLabel}>
                Ciudad
              </ThemedText>
              <View style={styles.inputWrapper}>
                <Feather name="map" size={20} color="#6B7280" style={styles.inputIcon} />
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  style={{
                    flex: 1,
                    height: 48,
                    border: 'none',
                    outline: 'none',
                    fontSize: 16,
                    color: '#1F2937',
                    backgroundColor: 'transparent',
                    paddingLeft: 40,
                  }}
                />
              </View>
            </View>

            {/* State Input */}
            <View style={styles.inputGroup}>
              <ThemedText type="body" style={styles.inputLabel}>
                Provincia
              </ThemedText>
              <View style={styles.inputWrapper}>
                <Feather name="flag" size={20} color="#6B7280" style={styles.inputIcon} />
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  style={{
                    flex: 1,
                    height: 48,
                    border: 'none',
                    outline: 'none',
                    fontSize: 16,
                    color: '#1F2937',
                    backgroundColor: 'transparent',
                    paddingLeft: 40,
                  }}
                />
              </View>
            </View>

            {/* Zip Code Input */}
            <View style={styles.inputGroup}>
              <ThemedText type="body" style={styles.inputLabel}>
                Código Postal
              </ThemedText>
              <View style={styles.inputWrapper}>
                <Feather name="hash" size={20} color="#6B7280" style={styles.inputIcon} />
                <input
                  type="text"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  placeholder="42001"
                  style={{
                    flex: 1,
                    height: 48,
                    border: 'none',
                    outline: 'none',
                    fontSize: 16,
                    color: '#1F2937',
                    backgroundColor: 'transparent',
                    paddingLeft: 40,
                  }}
                />
              </View>
            </View>

            {/* Web Notice */}
            <View style={styles.infoBanner}>
              <Feather name="globe" size={20} color={PRIMARY} />
              <ThemedText type="small" style={{ color: PRIMARY, flex: 1, marginLeft: 12 }}>
                En la versión web se usará la ubicación del centro de Soria por defecto.
              </ThemedText>
            </View>

            {/* Save Button */}
            <Pressable
              onPress={handleSave}
              disabled={loading || success}
              style={[styles.saveButton, (loading || success) && { opacity: 0.6 }]}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <ThemedText type="h4" style={{ color: "#FFF", fontWeight: "600" }}>
                  {success ? 'Guardado ✓' : existingAddress?.id ? 'Actualizar dirección' : 'Guardar dirección'}
                </ThemedText>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#FAFAFA",
    minHeight: "100vh",
    flexWrap: "wrap" as any,
    ...Platform.select({
      web: {
        height: "100vh",
        overflow: "hidden",
      },
    }),
  },
  // LEFT: Hero Section
  heroSection: {
    flex: 1,
    minWidth: 300,
    maxWidth: 600,
    backgroundColor: PRIMARY,
    padding: 48,
    justifyContent: "center",
  },
  heroContent: {
    maxWidth: 480,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 48,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  logoText: {
    color: "#FFF",
    marginLeft: 16,
    fontSize: 28,
    fontWeight: "700",
  },
  heroTextContainer: {
    marginBottom: 48,
  },
  heroTitle: {
    fontSize: 48,
    fontWeight: "800",
    color: "#FFF",
    marginBottom: 16,
    lineHeight: 56,
  },
  heroSubtitle: {
    fontSize: 18,
    color: "rgba(255,255,255,0.9)",
    lineHeight: 28,
  },
  heroCard: {
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 32,
    marginBottom: 32,
    ...Platform.select({
      web: {
        boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
      },
    }),
  },
  heroCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  heroCardDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginBottom: 16,
  },
  coverageBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    padding: 12,
    borderRadius: 12,
  },
  tipsContainer: {
    gap: 16,
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  // RIGHT: Form Section
  formSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 48,
  },
  formScrollView: {
    flex: 1,
    width: "100%",
  },
  formScrollContent: {
    alignItems: "center",
    paddingVertical: 48,
  },
  formCard: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 48,
    ...Platform.select({
      web: {
        boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
      },
    }),
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#6EE7B7",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FCD34D",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: PRIMARY + "15",
    borderWidth: 1,
    borderColor: PRIMARY + "40",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  gpsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PRIMARY,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    ...Platform.select({
      web: {
        boxShadow: "0 4px 12px rgba(220, 38, 38, 0.3)",
      },
    }),
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    height: 48,
    position: "relative",
    ...Platform.select({
      web: {
        display: "flex",
      },
    }),
  },
  inputIcon: {
    position: "absolute",
    left: 12,
    zIndex: 1,
  },
  suggestionsBox: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  suggestionItem: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  saveButton: {
    height: 56,
    backgroundColor: PRIMARY,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      web: {
        boxShadow: "0 4px 12px rgba(220, 38, 38, 0.3)",
      },
    }),
  },
});
