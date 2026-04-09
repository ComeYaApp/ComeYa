import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Button } from '@/components/Button';
import { ConfirmModal } from '@/components/ConfirmModal';
import { StripeConnectSetup } from '@/components/StripeConnectSetup';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { apiRequest } from '@/lib/query-client';
import { Spacing, BorderRadius, ComeYaColors, Shadows } from '@/constants/theme';

interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

interface PaymentHistory {
  payment: {
    id: string;
    amount: number;
    method: string;
    status: string;
    createdAt: string;
  };
  order: {
    id: string;
    total: number;
    status: string;
  };
}

const isWeb = Platform.OS === 'web';

export default function PaymentMethodsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [cards, setCards] = useState<SavedCard[]>([]);
  const [history, setHistory] = useState<PaymentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<string | null>(null);

  const isDriver = user?.role === 'delivery_driver';

  useEffect(() => {
    if (!isDriver) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [isDriver]);

  const loadData = async () => {
    try {
      const [cardsRes, historyRes] = await Promise.all([
        apiRequest('GET', '/api/payments/cards'),
        apiRequest('GET', '/api/payments/history'),
      ]);
      const cardsData = await cardsRes.json();
      const historyData = await historyRes.json();
      setCards(cardsData.cards || []);
      setHistory(historyData.payments || []);
    } catch (error) {
      console.error('Error loading payment data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    if (!isDriver) {
      setRefreshing(true);
      loadData();
    }
  };

  const handleSetDefault = async (cardId: string) => {
    try {
      await apiRequest('PUT', `/api/payments/cards/${cardId}/default`);
      showToast('Tarjeta predeterminada actualizada', 'success');
      await loadData();
    } catch (error: any) {
      showToast('Error al actualizar tarjeta', 'error');
    }
  };

  const confirmDeleteCard = async () => {
    if (!cardToDelete) return;
    try {
      await apiRequest('DELETE', `/api/payments/cards/${cardToDelete}`);
      showToast('Tarjeta eliminada', 'success');
      await loadData();
    } catch (error: any) {
      showToast('Error al eliminar tarjeta', 'error');
    } finally {
      setShowDeleteModal(false);
      setCardToDelete(null);
    }
  };

  const getBrandIcon = (brand: string) => {
    const b = brand.toLowerCase();
    if (b === 'visa') return 'credit-card';
    if (b === 'mastercard') return 'credit-card';
    if (b === 'amex') return 'credit-card';
    return 'credit-card';
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ComeYaColors.primary} />
          <ThemedText type="body" style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
            Cargando métodos de pago...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h3">{isDriver ? 'Método de Pago' : 'Métodos de Pago'}</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ComeYaColors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Driver: Stripe Connect Setup */}
        {isDriver ? (
          <>
            <View style={styles.section}>
              <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
                Configuración de Pagos
              </ThemedText>
              <StripeConnectSetup />
            </View>

            <View style={[styles.infoBanner, { backgroundColor: ComeYaColors.primary + '10', borderColor: ComeYaColors.primary + '30' }]}>
              <Feather name="info" size={20} color={ComeYaColors.primary} />
              <View style={{ flex: 1, marginLeft: Spacing.md }}>
                <ThemedText type="body" style={{ color: ComeYaColors.primary, fontWeight: '600' }}>
                  ¿Cómo funcionan los pagos?
                </ThemedText>
                <ThemedText type="small" style={{ color: ComeYaColors.primary, marginTop: 4 }}>
                  Cuando confirmes una entrega, tu pago se libera automáticamente y Stripe lo transfiere a tu cuenta bancaria en 1-2 días hábiles.
                </ThemedText>
              </View>
            </View>
          </>
        ) : (
          <>
            {/* Customer: Cards and payment history */}
        {isWeb && (
          <View style={[styles.card, { backgroundColor: ComeYaColors.warning + '15', borderColor: ComeYaColors.warning + '30', borderWidth: 1 }, Shadows.sm]}>
            <View style={styles.cardHeader}>
              <Feather name="info" size={20} color={ComeYaColors.warning} />
              <ThemedText type="h4" style={{ marginLeft: Spacing.sm, color: ComeYaColors.warning }}>
                Función no disponible en web
              </ThemedText>
            </View>
            <ThemedText type="body" style={{ color: ComeYaColors.warning }}>
              Para agregar tarjetas, usa la aplicación móvil. Aquí puedes ver tus tarjetas guardadas e historial.
            </ThemedText>
          </View>
        )}

        {/* Saved cards */}
        {cards.length > 0 && (
          <View style={styles.section}>
            <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
              Tarjetas guardadas
            </ThemedText>
            {cards.map((card) => (
              <View key={card.id} style={[styles.card, { backgroundColor: theme.card }, Shadows.sm]}>
                <View style={styles.cardRow}>
                  <View style={styles.cardInfo}>
                    <Feather name={getBrandIcon(card.brand)} size={24} color={ComeYaColors.primary} />
                    <View style={{ marginLeft: Spacing.md }}>
                      <ThemedText type="body" style={{ fontWeight: '600', textTransform: 'capitalize' }}>
                        {card.brand} •••• {card.last4}
                      </ThemedText>
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>
                        Vence {card.expMonth}/{card.expYear}
                      </ThemedText>
                    </View>
                  </View>
                  {card.isDefault && (
                    <View style={[styles.badge, { backgroundColor: ComeYaColors.success + '20' }]}>
                      <ThemedText type="caption" style={{ color: ComeYaColors.success, fontWeight: '600' }}>
                        Predeterminada
                      </ThemedText>
                    </View>
                  )}
                </View>
                {!isWeb && (
                  <View style={styles.cardActions}>
                    {!card.isDefault && (
                      <Pressable
                        style={[styles.actionButton, { backgroundColor: theme.backgroundSecondary }]}
                        onPress={() => handleSetDefault(card.id)}
                      >
                        <Feather name="check" size={16} color={ComeYaColors.primary} />
                        <ThemedText type="small" style={{ color: ComeYaColors.primary, marginLeft: Spacing.xs }}>
                          Predeterminada
                        </ThemedText>
                      </Pressable>
                    )}
                    <Pressable
                      style={[styles.actionButton, { backgroundColor: ComeYaColors.error + '15' }]}
                      onPress={() => {
                        setCardToDelete(card.id);
                        setShowDeleteModal(true);
                      }}
                    >
                      <Feather name="trash-2" size={16} color={ComeYaColors.error} />
                      <ThemedText type="small" style={{ color: ComeYaColors.error, marginLeft: Spacing.xs }}>
                        Eliminar
                      </ThemedText>
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* No cards message */}
        {cards.length === 0 && !isWeb && (
          <View style={[styles.card, { backgroundColor: theme.card }, Shadows.sm]}>
            <View style={{ alignItems: 'center', paddingVertical: Spacing.xl }}>
              <Feather name="credit-card" size={48} color={theme.textSecondary} />
              <ThemedText type="h4" style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
                No tienes tarjetas guardadas
              </ThemedText>
              <ThemedText type="body" style={{ marginTop: Spacing.sm, color: theme.textSecondary, textAlign: 'center' }}>
                Agrega una tarjeta durante el checkout para pagos más rápidos
              </ThemedText>
            </View>
          </View>
        )}

        {/* Payment history */}
        {history.length > 0 && (
          <View style={styles.section}>
            <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
              Historial de pagos
            </ThemedText>
            {history.slice(0, 10).map((item) => (
              <View key={item.payment.id} style={[styles.card, { backgroundColor: theme.card }, Shadows.sm]}>
                <View style={styles.historyRow}>
                  <View style={styles.historyInfo}>
                    <Feather
                      name={item.payment.method === 'card' ? 'credit-card' : 'dollar-sign'}
                      size={20}
                      color={theme.textSecondary}
                    />
                    <View style={{ marginLeft: Spacing.md, flex: 1 }}>
                      <ThemedText type="body" style={{ fontWeight: '600' }}>
                        €{((item.payment.amount || 0) / 100).toFixed(2)}
                      </ThemedText>
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>
                        {new Date(item.payment.createdAt).toLocaleDateString('es-VE', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </ThemedText>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          item.payment.status === 'completed'
                            ? ComeYaColors.success + '20'
                            : ComeYaColors.warning + '20',
                      },
                    ]}
                  >
                    <ThemedText
                      type="caption"
                      style={{
                        color: item.payment.status === 'completed' ? ComeYaColors.success : ComeYaColors.warning,
                        fontWeight: '600',
                      }}
                    >
                      {item.payment.status === 'completed' ? 'Completado' : 'Pendiente'}
                    </ThemedText>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Info banner */}
        <View style={[styles.infoBanner, { backgroundColor: ComeYaColors.primary + '10', borderColor: ComeYaColors.primary + '30' }]}>
          <Feather name="shield" size={20} color={ComeYaColors.primary} />
          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <ThemedText type="body" style={{ color: ComeYaColors.primary, fontWeight: '600' }}>
              Pagos seguros con Stripe
            </ThemedText>
            <ThemedText type="small" style={{ color: ComeYaColors.primary, marginTop: 4 }}>
              Tus datos están protegidos con encriptación de nivel bancario.
            </ThemedText>
          </View>
        </View>
          </>
        )}
      </ScrollView>

      <ConfirmModal
        visible={showDeleteModal}
        title="Eliminar tarjeta"
        message="¿Estás seguro de eliminar esta tarjeta?"
        onConfirm={confirmDeleteCard}
        onCancel={() => {
          setShowDeleteModal(false);
          setCardToDelete(null);
        }}
        confirmText="Eliminar"
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    padding: Spacing.xs,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  section: {
    marginTop: Spacing.lg,
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  cardActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
  },
});
