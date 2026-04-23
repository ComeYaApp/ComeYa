import React, { useState } from 'react';
import { View, StyleSheet, Alert, Pressable, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Button } from '@/components/Button';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, ComeYaColors, Shadows } from '@/constants/theme';
import { apiRequest } from '@/lib/query-client';

export default function PickupScannerScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const validateCode = async () => {
    if (code.length !== 6) {
      Alert.alert('Error', 'El código debe tener 6 dígitos');
      return;
    }

    setLoading(true);
    try {
      // Buscar pedido por código
      const response = await apiRequest('GET', '/api/business/orders');
      const data = await response.json();
      
      if (data.success) {
        const order = data.orders.find((o: any) => o.pickupCode === code);
        
        if (!order) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert('❌ Código inválido', 'No se encontró ningún pedido con este código');
          return;
        }

        if (order.status !== 'ready') {
          Alert.alert('⚠️ Pedido no listo', 'Este pedido aún no está listo para recoger');
          return;
        }

        // Confirmar entrega
        Alert.alert(
          '✅ Código válido',
          `Pedido #${order.id.slice(-6)}\nCliente: ${order.customer?.name || 'N/A'}\n\n¿Confirmar entrega?`,
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Confirmar',
              onPress: async () => {
                try {
                  await apiRequest('POST', `/api/orders/${order.id}/mark-picked-up`);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  Alert.alert('🎉 ¡Listo!', 'Pedido marcado como recogido');
                  setCode('');
                  navigation.goBack();
                } catch (error) {
                  Alert.alert('Error', 'No se pudo confirmar la entrega');
                }
              },
            },
          ]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo validar el código');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h2">Escanear Código</ThemedText>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: ComeYaColors.primary + '20' }]}>
          <Feather name="hash" size={64} color={ComeYaColors.primary} />
        </View>

        <ThemedText type="h3" style={{ textAlign: 'center', marginTop: Spacing.xl }}>
          Ingresa el código de recogida
        </ThemedText>

        <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: 'center', marginTop: Spacing.sm }}>
          El cliente te mostrará un código de 6 dígitos
        </ThemedText>

        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="000000"
          placeholderTextColor={theme.textSecondary}
          keyboardType="number-pad"
          maxLength={6}
          style={[
            styles.input,
            {
              backgroundColor: theme.backgroundSecondary,
              color: theme.text,
              borderColor: code.length === 6 ? ComeYaColors.success : theme.border,
            },
          ]}
          autoFocus
        />

        <Button
          onPress={validateCode}
          disabled={code.length !== 6 || loading}
          style={{ marginTop: Spacing.xl }}
        >
          {loading ? 'Validando...' : 'Validar Código'}
        </Button>

        <View style={[styles.infoBox, { backgroundColor: ComeYaColors.primary + '10', marginTop: Spacing.xl }]}>
          <Feather name="info" size={20} color={ComeYaColors.primary} />
          <ThemedText type="small" style={{ color: ComeYaColors.primary, marginLeft: Spacing.sm, flex: 1 }}>
            También puedes pedirle al cliente que te muestre el código QR para escanearlo más rápido
          </ThemedText>
        </View>
      </View>
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
  content: {
    flex: 1,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    width: '100%',
    fontSize: 32,
    fontFamily: 'monospace',
    textAlign: 'center',
    letterSpacing: 8,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    marginTop: Spacing.xl,
  },
  infoBox: {
    flexDirection: 'row',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'flex-start',
  },
});
