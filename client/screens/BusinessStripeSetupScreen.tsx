import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
  Alert,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/ThemedText';
import { BackButton } from '@/components/BackButton';
import { useTheme } from '@/hooks/useTheme';
import { useBusiness } from '@/contexts/BusinessContext';
import { Spacing, BorderRadius, ComeYaColors, Shadows } from '@/constants/theme';
import { apiRequest } from '@/lib/query-client';

interface StripeStatus {
  connected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  accountId?: string;
}

export default function BusinessStripeSetupScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const { selectedBusiness } = useBusiness();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<StripeStatus>({
    connected: false,
    chargesEnabled: false,
    payoutsEnabled: false,
    detailsSubmitted: false,
  });

  const loadStripeStatus = async () => {
    try {
      const response = await apiRequest('GET', '/api/business/stripe/status');
      const data = await response.json();
      
      if (data.success) {
        setStripeStatus({
          connected: data.connected || false,
          chargesEnabled: data.chargesEnabled || false,
          payoutsEnabled: data.payoutsEnabled || false,
          detailsSubmitted: data.detailsSubmitted || false,
          accountId: data.accountId,
        });
      }
    } catch (error) {
      console.error('Error loading Stripe status:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadStripeStatus();
    }, [])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStripeStatus();
    setRefreshing(false);
  };

  const handleConnectStripe = async () => {
    setConnecting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const response = await apiRequest('POST', '/api/business/stripe/connect', {});
      const data = await response.json();

      if (data.success && data.onboardingUrl) {
        await Linking.openURL(data.onboardingUrl);
        
        // Esperar un momento y recargar el estado
        setTimeout(() => {
          loadStripeStatus();
        }, 2000);
      } else {
        Alert.alert('Error', data.error || 'No se pudo iniciar la conexión con Stripe');
      }
    } catch (error: any) {
      console.error('Error connecting Stripe:', error);
      Alert.alert('Error', 'No se pudo conectar con Stripe. Intenta de nuevo.');
    } finally {
      setConnecting(false);
    }
  };

  const handleOpenStripeDashboard = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const response = await apiRequest('GET', '/api/business/stripe/dashboard-link');
      const data = await response.json();

      if (data.success && data.url) {
        await Linking.openURL(data.url);
      } else {
        Alert.alert('Error', 'No se pudo abrir el dashboard de Stripe');
      }
    } catch (error) {
      console.error('Error opening Stripe dashboard:', error);
      Alert.alert('Error', 'No se pudo abrir el dashboard de Stripe');
    }
  };

  const handleDisconnectStripe = () => {
    Alert.alert(
      'Desconectar Stripe',
      '¿Estás seguro? No podrás recibir pagos hasta que vuelvas a conectar tu cuenta.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desconectar',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await apiRequest('DELETE', '/api/business/stripe/disconnect');
              const data = await response.json();

              if (data.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                await loadStripeStatus();
              }
            } catch (error) {
              Alert.alert('Error', 'No se pudo desconectar la cuenta');
            }
          },
        },
      ]
    );
  };

  const getStatusColor = () => {
    if (!stripeStatus.connected) return theme.textSecondary;
    if (stripeStatus.chargesEnabled && stripeStatus.payoutsEnabled) return ComeYaColors.success;
    if (stripeStatus.detailsSubmitted) return ComeYaColors.warning;
    return ComeYaColors.error;
  };

  const getStatusText = () => {
    if (!stripeStatus.connected) return 'No conectada';
    if (stripeStatus.chargesEnabled && stripeStatus.payoutsEnabled) return 'Activa y verificada';
    if (stripeStatus.detailsSubmitted) return 'En verificación';
    return 'Información incompleta';
  };

  const getStatusIcon = () => {
    if (!stripeStatus.connected) return 'x-circle';
    if (stripeStatus.chargesEnabled && stripeStatus.payoutsEnabled) return 'check-circle';
    if (stripeStatus.detailsSubmitted) return 'clock';
    return 'alert-circle';
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
          <BackButton color={theme.text} />
          <ThemedText type="h3">Configuración de Pagos</ThemedText>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ComeYaColors.primary} />
          <ThemedText style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
            Cargando información...
          </ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <BackButton color={theme.text} />
        <ThemedText type="h3">Configuración de Pagos</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={ComeYaColors.primary}
          />
        }
      >
        {/* Status Card */}
        <View style={[styles.statusCard, { backgroundColor: theme.card }, Shadows.md]}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusIcon, { backgroundColor: getStatusColor() + '20' }]}>
              <Feather name={getStatusIcon() as any} size={32} color={getStatusColor()} />
            </View>
            <View style={styles.statusInfo}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Estado de Cuenta Stripe
              </ThemedText>
              <ThemedText type="h3" style={{ color: getStatusColor(), marginTop: 4 }}>
                {getStatusText()}
              </ThemedText>
            </View>
          </View>

          {stripeStatus.connected && (
            <View style={styles.statusDetails}>
              <View style={styles.statusRow}>
                <Feather
                  name={stripeStatus.chargesEnabled ? 'check-circle' : 'x-circle'}
                  size={18}
                  color={stripeStatus.chargesEnabled ? ComeYaColors.success : ComeYaColors.error}
                />
                <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                  Recibir pagos
                </ThemedText>
              </View>
              <View style={styles.statusRow}>
                <Feather
                  name={stripeStatus.payoutsEnabled ? 'check-circle' : 'x-circle'}
                  size={18}
                  color={stripeStatus.payoutsEnabled ? ComeYaColors.success : ComeYaColors.error}
                />
                <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                  Transferencias bancarias
                </ThemedText>
              </View>
            </View>
          )}
        </View>

        {/* Actions */}
        {!stripeStatus.connected ? (
          <>
            <View style={[styles.infoCard, { backgroundColor: ComeYaColors.primary + '15' }]}>
              <Feather name="info" size={20} color={ComeYaColors.primary} />
              <View style={{ flex: 1, marginLeft: Spacing.md }}>
                <ThemedText type="body" style={{ fontWeight: '600', marginBottom: 4 }}>
                  Conecta tu cuenta de Stripe
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Para recibir pagos de tus ventas, necesitas conectar tu cuenta de Stripe Connect.
                </ThemedText>
              </View>
            </View>

            <Pressable
              style={[styles.primaryButton, { backgroundColor: ComeYaColors.primary }, Shadows.md]}
              onPress={handleConnectStripe}
              disabled={connecting}
            >
              {connecting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name="link" size={20} color="#fff" />
                  <ThemedText type="body" style={{ color: '#fff', fontWeight: '600', marginLeft: Spacing.sm }}>
                    Conectar Cuenta Stripe
                  </ThemedText>
                </>
              )}
            </Pressable>

            <View style={[styles.requirementsCard, { backgroundColor: theme.card }, Shadows.sm]}>
              <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
                ¿Qué necesitas?
              </ThemedText>
              <View style={styles.requirementRow}>
                <Feather name="check" size={18} color={ComeYaColors.success} />
                <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                  Identificación oficial (INE/Pasaporte)
                </ThemedText>
              </View>
              <View style={styles.requirementRow}>
                <Feather name="check" size={18} color={ComeYaColors.success} />
                <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                  RFC (Registro Federal de Contribuyentes)
                </ThemedText>
              </View>
              <View style={styles.requirementRow}>
                <Feather name="check" size={18} color={ComeYaColors.success} />
                <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                  CURP
                </ThemedText>
              </View>
              <View style={styles.requirementRow}>
                <Feather name="check" size={18} color={ComeYaColors.success} />
                <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                  Cuenta bancaria (CLABE interbancaria)
                </ThemedText>
              </View>
              <View style={styles.requirementRow}>
                <Feather name="check" size={18} color={ComeYaColors.success} />
                <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                  Comprobante de domicilio
                </ThemedText>
              </View>
            </View>
          </>
        ) : (
          <>
            <Pressable
              style={[styles.secondaryButton, { backgroundColor: theme.card, borderColor: theme.border }, Shadows.sm]}
              onPress={handleOpenStripeDashboard}
            >
              <Feather name="external-link" size={20} color={ComeYaColors.primary} />
              <ThemedText type="body" style={{ color: ComeYaColors.primary, fontWeight: '600', marginLeft: Spacing.sm }}>
                Abrir Dashboard de Stripe
              </ThemedText>
            </Pressable>

            <Pressable
              style={[styles.dangerButton, { backgroundColor: theme.card, borderColor: ComeYaColors.error }]}
              onPress={handleDisconnectStripe}
            >
              <Feather name="x-circle" size={20} color={ComeYaColors.error} />
              <ThemedText type="body" style={{ color: ComeYaColors.error, fontWeight: '600', marginLeft: Spacing.sm }}>
                Desconectar Cuenta
              </ThemedText>
            </Pressable>
          </>
        )}

        {/* Info Section */}
        <View style={[styles.infoSection, { backgroundColor: theme.card }, Shadows.sm]}>
          <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
            Información de Transferencias
          </ThemedText>
          <View style={styles.infoRow}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Frecuencia:
            </ThemedText>
            <ThemedText type="body" style={{ fontWeight: '600' }}>
              Diaria (automática)
            </ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Método:
            </ThemedText>
            <ThemedText type="body" style={{ fontWeight: '600' }}>
              Transferencia bancaria
            </ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Tiempo:
            </ThemedText>
            <ThemedText type="body" style={{ fontWeight: '600' }}>
              2-3 días hábiles
            </ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Comisión Stripe:
            </ThemedText>
            <ThemedText type="body" style={{ fontWeight: '600' }}>
              3.6% + $3 MXN
            </ThemedText>
          </View>
        </View>

        <View style={[styles.helpCard, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="help-circle" size={20} color={theme.textSecondary} />
          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Tus ingresos se procesan directamente a través de Stripe Connect. Recibes el 100% del precio base de tus productos. ComeYa agrega un 15% de markup al precio final del cliente.
            </ThemedText>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  statusCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  statusInfo: {
    flex: 1,
  },
  statusDetails: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
  },
  requirementsCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  infoSection: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  helpCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
});
