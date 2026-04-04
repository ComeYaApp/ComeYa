import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { Spacing, BorderRadius, ComeYaColors, Shadows } from '@/constants/theme';
import { apiRequest } from '@/lib/query-client';
import { useToast } from '@/contexts/ToastContext';

const PRESET_AMOUNTS = [10, 25, 50, 100];

export default function GiftCardsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'buy' | 'my-cards'>('buy');
  const [amount, setAmount] = useState('25');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [message, setMessage] = useState('');
  const [selectedDesign, setSelectedDesign] = useState('default');

  // Diseños
  const { data: designsData } = useQuery({
    queryKey: ['/api/gift-cards/designs'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/gift-cards/designs');
      return response.json();
    },
  });

  // Mis tarjetas
  const { data: myCardsData } = useQuery({
    queryKey: ['/api/gift-cards/my-cards'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/gift-cards/my-cards');
      return response.json();
    },
  });

  // Comprar gift card
  const purchaseMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/gift-cards/purchase', {
        amount: parseFloat(amount),
        recipientName: recipientName.trim() || undefined,
        recipientEmail: recipientEmail.trim() || undefined,
        message: message.trim() || undefined,
        design: selectedDesign,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast('¡Gift Card creada!', 'success');
        Alert.alert(
          'Gift Card Creada',
          `Código: ${data.giftCard.code}\n\nGuarda este código para compartirlo.`,
          [{ text: 'OK' }]
        );
        queryClient.invalidateQueries({ queryKey: ['/api/gift-cards/my-cards'] });
        setAmount('25');
        setRecipientName('');
        setRecipientEmail('');
        setMessage('');
      } else {
        showToast(data.error || 'Error al crear gift card', 'error');
      }
    },
  });

  const designs = designsData?.designs || [];
  const myCards = myCardsData || { purchased: [], redeemed: [] };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h2">Gift Cards</ThemedText>
        <View style={{ width: 44 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['buy', 'my-cards'] as const).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => {
              setActiveTab(tab);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={[
              styles.tab,
              {
                backgroundColor: activeTab === tab ? ComeYaColors.primary : theme.backgroundSecondary,
              },
            ]}
          >
            <ThemedText
              type="caption"
              style={{
                color: activeTab === tab ? '#FFFFFF' : theme.text,
                fontWeight: activeTab === tab ? '600' : '400',
              }}
            >
              {tab === 'buy' ? 'Comprar' : 'Mis Tarjetas'}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {activeTab === 'buy' ? (
          <View>
            {/* Amount Selection */}
            <View style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}>
              <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
                Monto
              </ThemedText>
              <View style={styles.amountGrid}>
                {PRESET_AMOUNTS.map((preset) => (
                  <Pressable
                    key={preset}
                    onPress={() => {
                      setAmount(preset.toString());
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={[
                      styles.amountButton,
                      {
                        backgroundColor:
                          amount === preset.toString()
                            ? ComeYaColors.primary
                            : theme.backgroundSecondary,
                        borderColor:
                          amount === preset.toString() ? ComeYaColors.primary : theme.border,
                      },
                    ]}
                  >
                    <ThemedText
                      type="body"
                      style={{
                        color: amount === preset.toString() ? '#FFFFFF' : theme.text,
                        fontWeight: '600',
                      }}
                    >
                      €{preset}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="Monto personalizado"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
                style={[
                  styles.input,
                  { backgroundColor: theme.backgroundSecondary, color: theme.text },
                ]}
              />
            </View>

            {/* Recipient Info */}
            <View style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}>
              <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
                Para (Opcional)
              </ThemedText>
              <TextInput
                value={recipientName}
                onChangeText={setRecipientName}
                placeholder="Nombre del destinatario"
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.input,
                  { backgroundColor: theme.backgroundSecondary, color: theme.text },
                ]}
              />
              <TextInput
                value={recipientEmail}
                onChangeText={setRecipientEmail}
                placeholder="Email del destinatario"
                placeholderTextColor={theme.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                style={[
                  styles.input,
                  { backgroundColor: theme.backgroundSecondary, color: theme.text },
                ]}
              />
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="Mensaje personalizado"
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={3}
                style={[
                  styles.textArea,
                  { backgroundColor: theme.backgroundSecondary, color: theme.text },
                ]}
              />
            </View>

            {/* Design Selection */}
            {designs.length > 0 && (
              <View style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}>
                <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
                  Diseño
                </ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.designsRow}>
                    {designs.map((design: any) => (
                      <Pressable
                        key={design.id}
                        onPress={() => {
                          setSelectedDesign(design.name);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        style={[
                          styles.designCard,
                          {
                            borderColor:
                              selectedDesign === design.name ? ComeYaColors.primary : theme.border,
                            borderWidth: selectedDesign === design.name ? 3 : 1,
                          },
                        ]}
                      >
                        <Image source={{ uri: design.imageUrl }} style={styles.designImage} contentFit="cover" />
                        <ThemedText type="caption" style={{ marginTop: 4, textAlign: 'center' }}>
                          {design.name}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Purchase Button */}
            <Pressable
              onPress={() => purchaseMutation.mutate()}
              disabled={!amount || parseFloat(amount) < 10 || purchaseMutation.isPending}
              style={[
                styles.purchaseButton,
                {
                  backgroundColor: ComeYaColors.primary,
                  opacity: amount && parseFloat(amount) >= 10 && !purchaseMutation.isPending ? 1 : 0.5,
                },
                Shadows.md,
              ]}
            >
              <Feather name="gift" size={20} color="#FFFFFF" />
              <ThemedText type="body" style={{ color: '#FFFFFF', marginLeft: 8, fontWeight: '600' }}>
                {purchaseMutation.isPending ? 'Creando...' : `Comprar €${amount}`}
              </ThemedText>
            </Pressable>
          </View>
        ) : (
          <View>
            {/* Purchased Cards */}
            <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
              Compradas ({myCards.purchased.length})
            </ThemedText>
            {myCards.purchased.map((card: any) => (
              <View key={card.id} style={[styles.cardItem, { backgroundColor: theme.card }, Shadows.sm]}>
                <View style={styles.cardLeft}>
                  <View style={[styles.cardIcon, { backgroundColor: ComeYaColors.primary + '20' }]}>
                    <Feather name="gift" size={24} color={ComeYaColors.primary} />
                  </View>
                  <View style={styles.cardInfo}>
                    <ThemedText type="body" style={{ fontWeight: '600' }}>
                      {card.code}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                      Saldo: €{card.balance.toFixed(2)}
                    </ThemedText>
                  </View>
                </View>
                <ThemedText type="body" style={{ color: ComeYaColors.primary, fontWeight: '600' }}>
                  €{card.amount.toFixed(2)}
                </ThemedText>
              </View>
            ))}

            {myCards.purchased.length === 0 && (
              <View style={styles.emptyState}>
                <Feather name="gift" size={48} color={theme.textSecondary} />
                <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
                  No has comprado gift cards aún
                </ThemedText>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </ThemedView>
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
    paddingBottom: Spacing.lg,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  tabs: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },
  section: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
  },
  amountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  amountButton: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    alignItems: 'center',
  },
  input: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 16,
    marginBottom: Spacing.sm,
  },
  textArea: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  designsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  designCard: {
    width: 100,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  designImage: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.lg,
  },
  purchaseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  cardItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.md,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['4xl'],
  },
});
