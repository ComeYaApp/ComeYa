import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Text, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { apiRequest } from '@/lib/query-client';
import { MobileSidebarWrapper } from '@/components/MobileSidebarWrapper';

const PRIMARY = '#DC2626';

export default function GroupOrderScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const routeGroupOrderId = route.params?.groupOrderId;
  const shareToken = route.params?.shareToken;

  const [resolvedGroupOrderId, setResolvedGroupOrderId] = useState<string | null>(routeGroupOrderId || null);

  useEffect(() => {
    const resolveGroupOrder = async () => {
      if (shareToken && !resolvedGroupOrderId) {
        try {
          const response = await apiRequest('GET', `/api/group-orders/by-token/${shareToken}`);
          const data = await response.json();
          if (data.success && data.groupOrder) {
            setResolvedGroupOrderId(data.groupOrder.id);
          }
        } catch (error) {
          console.error('Error resolving group order:', error);
        }
      }
    };
    resolveGroupOrder();
  }, [shareToken]);

  const groupOrderId = resolvedGroupOrderId;

  const bg     = isDark ? '#111'    : '#f7f7f7';
  const card   = isDark ? '#1e1e1e' : '#fff';
  const border = isDark ? '#333'    : '#e8e8e8';
  const text   = isDark ? '#fff'    : '#1a1a1a';
  const sub    = isDark ? '#aaa'    : '#666';
  const cardBg = isDark ? '#2a2a2a' : '#f9fafb';

  const { data: groupData, refetch, isLoading: isLoadingGroup } = useQuery({
    queryKey: ['/api/group-orders', groupOrderId],
    queryFn: async () => {
      if (!groupOrderId) return null;
      return (await apiRequest('GET', `/api/group-orders/${groupOrderId}`)).json();
    },
    enabled: !!groupOrderId,
    refetchInterval: 10000,
  });

  const lockMutation = useMutation({
    mutationFn: async () => (await apiRequest('POST', `/api/group-orders/${groupOrderId}/lock`, {})).json(),
    onSuccess: (data) => {
      if (data.success) {
        showToast('¡Pedido grupal creado!', 'success');
        navigation.navigate('OrderTracking', { orderId: data.orderId });
      } else showToast(data.error || 'Error al crear pedido', 'error');
    },
  });

  const handleCopyLink = () => {
    if (!group) return;
    const link = `${window.location.origin}/group-order/${group.shareToken}`;
    navigator.clipboard?.writeText(link).catch(() => {});
    showToast('Link copiado al portapapeles', 'success');
  };

  const handleShare = async () => {
    if (!group) return;
    const link = `${window.location.origin}/group-order/${group.shareToken}`;
    const msg = `¡Únete a mi pedido grupal en ${group.businessName}!\n\n${link}`;
    if (navigator.share) {
      await navigator.share({ title: 'Pedido Grupal - ComeYa', text: msg, url: link });
    } else {
      navigator.clipboard?.writeText(msg).catch(() => {});
      showToast('Link copiado', 'success');
    }
  };

  const group = groupData?.groupOrder;
  const isCreator = group?.creatorId === user?.id;
  const isOpen    = group?.status === 'open';
  const isExpired = group ? new Date(group.expiresAt) < new Date() : false;
  const totalParticipants = group?.participants?.length || 0;
  const totalAmount = (group?.totalAmount || 0) / 100;

  // If no groupOrderId and no shareToken, show empty state with sidebar
  if (!groupOrderId && !shareToken) {
    return (
      <View style={[s.root, { backgroundColor: bg }]}>
        <MobileSidebarWrapper title="Pedido Grupal" sidebarStyle={[s.sidebar, { backgroundColor: card, borderRightColor: border }]}>
          <View style={[s.sideHeader, { borderBottomColor: border }]}>
            <View style={[s.sideIconWrap, { backgroundColor: PRIMARY + '15' }]}>
              <Feather name="users" size={32} color={PRIMARY} />
            </View>
            <Text style={[s.sideTitle, { color: text }]}>Pedido Grupal</Text>
          </View>
          <View style={s.sideStats}>
            <Text style={{ color: sub, textAlign: 'center', paddingHorizontal: 16 }}>
              Usa el enlace compartido para unirte a un pedido grupal existente.
            </Text>
          </View>
          <View style={[s.sideFooter, { borderTopColor: border }]}>
            <Pressable 
              onPress={() => navigation.navigate('Main')} 
              style={[s.backBtn, { backgroundColor: PRIMARY }]}
            >
              <Feather name="home" size={16} color="#fff" />
              <Text style={[s.backBtnText, { color: '#fff' }]}>Volver al inicio</Text>
            </Pressable>
          </View>
        </MobileSidebarWrapper>
        <View style={s.main} />
      </View>
    );
  }

  // If still loading after having a groupOrderId
  if (!group && isLoadingGroup) {
    return (
      <View style={[s.root, { backgroundColor: bg }]}>
        <MobileSidebarWrapper title="Pedido Grupal" sidebarStyle={[s.sidebar, { backgroundColor: card, borderRightColor: border }]}>
          <View style={[s.sideHeader, { borderBottomColor: border }]}>
            <View style={[s.sideIconWrap, { backgroundColor: PRIMARY + '15' }]}>
              <Feather name="users" size={32} color={PRIMARY} />
            </View>
            <Text style={[s.sideTitle, { color: text }]}>Pedido Grupal</Text>
          </View>
          <View style={s.sideStats}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={[s.loadingText, { color: sub, marginTop: 12 }]}>Cargando pedido grupal...</Text>
          </View>
          <View style={[s.sideFooter, { borderTopColor: border }]}>
            <Pressable 
              onPress={() => navigation.goBack()} 
              style={s.backBtn}
            >
              <Feather name="arrow-left" size={16} color={sub} />
              <Text style={[s.backBtnText, { color: text }]}>Volver</Text>
            </Pressable>
          </View>
        </MobileSidebarWrapper>
        <View style={s.main} />
      </View>
    );
  }

  // If group order not found
  if (groupOrderId && !group && !isLoadingGroup) {
    return (
      <View style={[s.root, { backgroundColor: bg }]}>
        <MobileSidebarWrapper title="Pedido Grupal" sidebarStyle={[s.sidebar, { backgroundColor: card, borderRightColor: border }]}>
          <View style={[s.sideHeader, { borderBottomColor: border }]}>
            <View style={[s.sideIconWrap, { backgroundColor: '#EF444420' }]}>
              <Feather name="alert-circle" size={32} color="#EF4444" />
            </View>
            <Text style={[s.sideTitle, { color: text }]}>Grupo no encontrado</Text>
          </View>
          <View style={s.sideStats}>
            <Text style={{ color: sub, textAlign: 'center', paddingHorizontal: 16 }}>
              Este enlace ya expiró o no existe.
            </Text>
          </View>
          <View style={[s.sideFooter, { borderTopColor: border }]}>
            <Pressable 
              onPress={() => navigation.navigate('Main')} 
              style={[s.backBtn, { backgroundColor: PRIMARY }]}
            >
              <Feather name="home" size={16} color="#fff" />
              <Text style={[s.backBtnText, { color: '#fff' }]}>Volver al inicio</Text>
            </Pressable>
          </View>
        </MobileSidebarWrapper>
        <View style={s.main} />
      </View>
    );
  }

  if (!group) {
    return (
      <View style={[s.root, { backgroundColor: bg }]}>
        <MobileSidebarWrapper title="Pedido Grupal" sidebarStyle={[s.sidebar, { backgroundColor: card, borderRightColor: border }]}>
          <View style={[s.sideHeader, { borderBottomColor: border }]}>
            <View style={[s.sideIconWrap, { backgroundColor: PRIMARY + '15' }]}>
              <Feather name="users" size={32} color={PRIMARY} />
            </View>
            <Text style={[s.sideTitle, { color: text }]}>Pedido Grupal</Text>
          </View>
          <View style={s.sideStats}>
            <ActivityIndicator size="large" color={PRIMARY} />
          </View>
          <View style={[s.sideFooter, { borderTopColor: border }]}>
            <Pressable 
              onPress={() => navigation.goBack()} 
              style={s.backBtn}
            >
              <Feather name="arrow-left" size={16} color={sub} />
              <Text style={[s.backBtnText, { color: text }]}>Volver</Text>
            </Pressable>
          </View>
        </MobileSidebarWrapper>
        <View style={s.main} />
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <MobileSidebarWrapper title="Pedido Grupal" sidebarStyle={[s.sidebar, { backgroundColor: card, borderRightColor: border }]}>
        <View style={[s.sideHeader, { borderBottomColor: border }]}>
          <View style={[s.sideIconWrap, { backgroundColor: PRIMARY + '15' }]}>
            <Feather name="users" size={32} color={PRIMARY} />
          </View>
          <Text style={[s.sideTitle, { color: text }]}>{group.businessName}</Text>
          <View style={[s.statusBadge, { backgroundColor: isOpen ? '#10B98120' : '#F59E0B20', borderColor: isOpen ? '#10B98140' : '#F59E0B40' }]}>
            <Feather name={isOpen ? 'unlock' : 'lock'} size={13} color={isOpen ? '#10B981' : '#F59E0B'} />
            <Text style={{ color: isOpen ? '#10B981' : '#F59E0B', fontSize: 12, fontWeight: '600' }}>
              {isOpen ? 'Abierto' : 'Cerrado'}
            </Text>
          </View>
        </View>
        <View style={s.sideStats}>
          <View style={[s.statBox, { backgroundColor: cardBg }]}>
            <Text style={[s.statNum, { color: PRIMARY }]}>{totalParticipants}</Text>
            <Text style={[s.statLabel, { color: sub }]}>Participantes</Text>
          </View>
          <View style={[s.statBox, { backgroundColor: cardBg }]}>
            <Text style={[s.statNum, { color: text }]}>€{totalAmount.toFixed(2)}</Text>
            <Text style={[s.statLabel, { color: sub }]}>Total</Text>
          </View>
        </View>
        <View style={[s.sideFooter, { borderTopColor: border }]}>
          <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
            <Feather name="arrow-left" size={16} color={sub} />
            <Text style={[s.backBtnText, { color: text }]}>Volver</Text>
          </Pressable>
        </View>
      </MobileSidebarWrapper>

      <ScrollView style={s.main} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Info del grupo */}
        <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
          <View style={s.cardHeader}>
            <Feather name="info" size={18} color={PRIMARY} />
            <Text style={[s.cardTitle, { color: text }]}>Detalles del grupo</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={[s.infoLabel, { color: sub }]}>Estado</Text>
            <Text style={[s.infoValue, { color: isOpen ? '#10B981' : '#F59E0B' }]}>{isOpen ? 'Abierto' : 'Cerrado'}</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={[s.infoLabel, { color: sub }]}>Expira</Text>
            <Text style={[s.infoValue, { color: isExpired ? '#EF4444' : text }]}>
              {new Date(group.expiresAt).toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
            </Text>
          </View>
          <View style={s.infoRow}>
            <Text style={[s.infoLabel, { color: sub }]}>Total acumulado</Text>
            <Text style={[s.infoValue, { color: PRIMARY }]}>€{totalAmount.toFixed(2)}</Text>
          </View>
        </View>

        {/* Share */}
        {isOpen && isCreator && (
          <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
            <View style={s.cardHeader}>
              <Feather name="share-2" size={18} color={PRIMARY} />
              <Text style={[s.cardTitle, { color: text }]}>Invita a tus amigos</Text>
            </View>
            <View style={[s.linkBox, { backgroundColor: cardBg, borderColor: border }]}>
              <Text style={[s.linkText, { color: sub }]} numberOfLines={1}>
                {`${typeof window !== 'undefined' ? window.location.origin : ''}/group-order/${group.shareToken}`}
              </Text>
            </View>
            <View style={s.shareRow}>
              <Pressable onPress={handleShare} style={[s.shareBtn, { backgroundColor: PRIMARY }]}>
                <Feather name="share-2" size={16} color="#fff" />
                <Text style={s.shareBtnText}>Compartir</Text>
              </Pressable>
              <Pressable onPress={handleCopyLink} style={[s.shareBtn, { backgroundColor: cardBg, borderWidth: 1, borderColor: border }]}>
                <Feather name="copy" size={16} color={text} />
                <Text style={[s.shareBtnText, { color: text }]}>Copiar link</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Participantes */}
        <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
          <View style={s.cardHeader}>
            <Feather name="users" size={18} color={PRIMARY} />
            <Text style={[s.cardTitle, { color: text }]}>Participantes ({totalParticipants})</Text>
            <Text style={[s.totalBadge, { color: PRIMARY }]}>€{totalAmount.toFixed(2)}</Text>
          </View>
          {group.participants?.map((p: any) => (
            <View key={p.id} style={[s.participantRow, { borderBottomColor: border }]}>
              <View style={[s.participantAvatar, { backgroundColor: PRIMARY + '20' }]}>
                <Feather name="user" size={18} color={PRIMARY} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[s.participantName, { color: text }]}>
                  {p.userName}{p.userId === group.creatorId ? ' 👑' : ''}
                </Text>
                <Text style={[s.participantItems, { color: sub }]}>{p.items?.length || 0} productos</Text>
              </View>
              <View style={s.participantRight}>
                <Text style={[s.participantAmount, { color: text }]}>€{(p.subtotal / 100).toFixed(2)}</Text>
                {p.paymentStatus === 'paid' && <Feather name="check-circle" size={16} color="#10B981" />}
              </View>
            </View>
          ))}
        </View>

        {/* Cerrar grupo */}
        {isCreator && isOpen && !isExpired && totalParticipants > 0 && (
          <Pressable
            onPress={() => lockMutation.mutate()}
            disabled={lockMutation.isPending}
            style={[s.lockBtn, { backgroundColor: PRIMARY, opacity: lockMutation.isPending ? 0.6 : 1 }]}
          >
            {lockMutation.isPending
              ? <ActivityIndicator color="#fff" />
              : <><Feather name="lock" size={18} color="#fff" /><Text style={s.lockBtnText}>Cerrar grupo y crear pedido</Text></>
            }
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:              { flex: 1, flexDirection: 'row', overflow: 'hidden' as any },
  sidebar:           { width: 280, borderRightWidth: 1, flexDirection: 'column' as any },
  sideHeader:        { padding: 24, alignItems: 'center', borderBottomWidth: 1 },
  sideIconWrap:      { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  sideTitle:         { fontSize: 16, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  statusBadge:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  sideStats:         { flex: 1, justifyContent: 'center', padding: 16 },
  statBox:           { flex: 1, borderRadius: 10, padding: 12, alignItems: 'center' },
  statNum:           { fontSize: 20, fontWeight: '800' },
  statLabel:         { fontSize: 11, marginTop: 2 },
  sideFooter:        { borderTopWidth: 1, padding: 16, marginTop: 'auto' as any },
  backBtn:           { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  backBtnText:       { fontSize: 14, fontWeight: '600' },
  main:              { flex: 1, height: '100vh' as any },
  content:           { padding: 32, maxWidth: 680, paddingBottom: 80 },
  card:              { borderRadius: 14, borderWidth: 1, padding: 20, marginBottom: 16 },
  cardHeader:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  cardTitle:         { fontSize: 15, fontWeight: '700', flex: 1 },
  totalBadge:        { fontSize: 16, fontWeight: '800' },
  infoRow:           { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  infoLabel:         { fontSize: 14 },
  infoValue:         { fontSize: 14, fontWeight: '600' },
  linkBox:           { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 12 },
  linkText:          { fontSize: 13 },
  shareRow:          { flexDirection: 'row', gap: 10 },
  shareBtn:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10 },
  shareBtnText:      { fontSize: 14, fontWeight: '600', color: '#fff' },
  participantRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  participantAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  participantName:   { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  participantItems:  { fontSize: 12 },
  participantRight:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  participantAmount: { fontSize: 15, fontWeight: '700' },
  lockBtn:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 12 },
  lockBtnText:       { color: '#fff', fontSize: 16, fontWeight: '700' },
  loadingText:       { marginTop: 12, fontSize: 14 },
});
