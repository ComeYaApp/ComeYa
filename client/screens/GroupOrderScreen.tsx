import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Share,
  Alert,
  Clipboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { Spacing, BorderRadius, ComeYaColors, Shadows } from '@/constants/theme';
import { apiRequest } from '@/lib/query-client';
import { useToast } from '@/contexts/ToastContext';

type GroupOrderRouteProp = RouteProp<
  {
    GroupOrder: {
      groupOrderId?: string;
      shareToken?: string;
    };
  },
  'GroupOrder'
>;

export default function GroupOrderScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<GroupOrderRouteProp>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { groupOrderId, shareToken } = route.params || {};

  // Cargar detalles del grupo
  const { data: groupData, refetch } = useQuery({
    queryKey: ['/api/group-orders', groupOrderId],
    queryFn: async () => {
      if (!groupOrderId) return null;
      const response = await apiRequest('GET', `/api/group-orders/${groupOrderId}`);
      return response.json();
    },
    enabled: !!groupOrderId,
  });

  const group = groupData?.groupOrder;
  const isCreator = group?.creatorId === user?.id;
  const isOpen = group?.status === 'open';

  // Cerrar grupo y crear pedido
  const lockMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/group-orders/${groupOrderId}/lock`, {});
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast('Pedido grupal creado!', 'success');
        navigation.navigate('OrderTracking', { orderId: data.orderId });
      } else {
        showToast(data.error || 'Error al crear pedido', 'error');
      }
    },
  });

  const handleShare = async () => {
    if (!group) return;

    const shareLink = `ComeYa://group-order/${group.shareToken}`;
    const message = `¡Únete a mi pedido grupal en ${group.businessName}!\n\nLink: ${shareLink}\n\nExpira: ${new Date(group.expiresAt).toLocaleString('es-VE')}`;

    try {
      await Share.share({
        message,
        title: 'Pedido Grupal - ComeYa',
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleCopyLink = () => {
    if (!group) return;
    const shareLink = `ComeYa://group-order/${group.shareToken}`;
    Clipboard.setString(shareLink);
    showToast('Link copiado!', 'success');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleLockAndOrder = () => {
    Alert.alert(
      'Cerrar Grupo',
      '¿Estás seguro? No se podrán agregar más participantes.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar y Pedir',
          style: 'destructive',
          onPress: () => lockMutation.mutate(),
        },
      ]
    );
  };

  if (!group) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="h2">Pedido Grupal</ThemedText>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.emptyState}>
          <Feather name="users" size={64} color={theme.textSecondary} />
          <ThemedText type="h3" style={{ marginTop: Spacing.lg }}>
            Cargando...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  const totalParticipants = group.participants?.length || 0;
  const totalAmount = group.totalAmount / 100;
  const expiresAt = new Date(group.expiresAt);
  const isExpired = expiresAt < new Date();

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h2">Pedido Grupal</ThemedText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Status Card */}
        <View style={[styles.statusCard, { backgroundColor: theme.card }, Shadows.md]}>
          <View style={styles.statusHeader}>
            <Feather
              name={isOpen ? 'unlock' : 'lock'}
              size={24}
              color={isOpen ? ComeYaColors.success : ComeYaColors.warning}
            />
            <ThemedText type="h3" style={{ marginLeft: Spacing.sm }}>
              {group.businessName}
            </ThemedText>
          </View>
          <View style={styles.statusRow}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Estado:
            </ThemedText>
            <ThemedText
              type="body"
              style={{
                color: isOpen ? ComeYaColors.success : ComeYaColors.warning,
                fontWeight: '600',
              }}
            >
              {isOpen ? 'Abierto' : 'Cerrado'}
            </ThemedText>
          </View>
          <View style={styles.statusRow}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Expira:
            </ThemedText>
            <ThemedText type="body">
              {expiresAt.toLocaleString('es-VE', {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: 'short',
              })}
            </ThemedText>
          </View>
        </View>

        {/* Share Card */}
        {isOpen && isCreator && (
          <View style={[styles.shareCard, { backgroundColor: theme.card }, Shadows.sm]}>
            <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
              Invita a tus amigos
            </ThemedText>
            <View style={styles.shareButtons}>
              <Pressable
                onPress={handleShare}
                style={[styles.shareButton, { backgroundColor: ComeYaColors.primary }]}
              >
                <Feather name="share-2" size={18} color="#FFFFFF" />
                <ThemedText type="body" style={{ color: '#FFFFFF', marginLeft: 8 }}>
                  Compartir
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={handleCopyLink}
                style={[styles.shareButton, { backgroundColor: theme.backgroundSecondary }]}
              >
                <Feather name="copy" size={18} color={theme.text} />
                <ThemedText type="body" style={{ marginLeft: 8 }}>
                  Copiar Link
                </ThemedText>
              </Pressable>
            </View>
          </View>
        )}

        {/* Participants */}
        <View style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}>
          <View style={styles.sectionHeader}>
            <ThemedText type="h4">Participantes ({totalParticipants})</ThemedText>
            <ThemedText type="h4" style={{ color: ComeYaColors.primary }}>
              €{totalAmount.toFixed(2)}
            </ThemedText>
          </View>

          {group.participants?.map((participant: any) => (
            <View key={participant.id} style={styles.participantRow}>
              <View style={styles.participantLeft}>
                <View
                  style={[
                    styles.participantAvatar,
                    { backgroundColor: ComeYaColors.primary + '20' },
                  ]}
                >
                  <Feather name="user" size={20} color={ComeYaColors.primary} />
                </View>
                <View style={styles.participantInfo}>
                  <ThemedText type="body" numberOfLines={1}>
                    {participant.userName}
                    {participant.userId === group.creatorId && ' (Creador)'}
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    {participant.items.length} items
                  </ThemedText>
                </View>
              </View>
              <View style={styles.participantRight}>
                <ThemedText type="body" style={{ fontWeight: '600' }}>
                  €{(participant.subtotal / 100).toFixed(2)}
                </ThemedText>
                {participant.paymentStatus === 'paid' && (
                  <Feather name="check-circle" size={16} color={ComeYaColors.success} />
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Actions */}
        {isCreator && isOpen && !isExpired && totalParticipants > 0 && (
          <Pressable
            onPress={handleLockAndOrder}
            disabled={lockMutation.isPending}
            style={[
              styles.lockButton,
              { backgroundColor: ComeYaColors.primary },
              Shadows.md,
            ]}
          >
            <Feather name="lock" size={20} color="#FFFFFF" />
            <ThemedText
              type="body"
              style={{ color: '#FFFFFF', marginLeft: 8, fontWeight: '600' }}
            >
              {lockMutation.isPending ? 'Creando pedido...' : 'Cerrar y Pedir'}
            </ThemedText>
          </Pressable>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  shareCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
  },
  shareButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  section: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  participantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  participantLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantInfo: {
    marginLeft: Spacing.sm,
    flex: 1,
  },
  participantRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  lockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
});
