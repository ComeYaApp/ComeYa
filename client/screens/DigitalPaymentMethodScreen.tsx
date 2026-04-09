import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { apiRequest } from '../lib/query-client';
import { ComeYaColors, Spacing, BorderRadius, Shadows } from '../constants/theme';

interface PaymentMethod {
  id: string;
  name: string;
  provider: string;
  displayName: string;
  isActive: boolean;
  requiresManualVerification: boolean;
  instructions: string;
}

interface Props {
  route?: { params?: { orderTotal?: number } };
}

const METHOD_CONFIG: Record<string, { icon: any; color: string; subtitle: string }> = {
  stripe_card:  { icon: 'credit-card', color: '#635BFF', subtitle: 'Visa, Mastercard, Amex' },
  stripe_bizum: { icon: 'smartphone',  color: '#00ADEF', subtitle: 'Pago instantáneo desde tu móvil' },
  paypal:       { icon: 'dollar-sign', color: '#003087', subtitle: 'Paga con tu cuenta PayPal' },
};

export default function DigitalPaymentMethodScreen({ route }: Props) {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PaymentMethod | null>(null);
  const [savedAccounts, setSavedAccounts] = useState<Record<string, string>>({}); // method -> detail
  const orderTotal = route?.params?.orderTotal || 0;

  useEffect(() => { loadMethods(); loadSavedAccounts(); }, []);

  const loadSavedAccounts = async () => {
    try {
      const res = await apiRequest('GET', '/api/payouts/accounts');
      const data = await res.json();
      if (data.success && data.accounts) {
        const map: Record<string, string> = {};
        for (const acc of data.accounts) {
          if (acc.method === 'bizum')   map['stripe_bizum'] = acc.pagoMovilPhone || '';
          if (acc.method === 'tarjeta') map['stripe_card']  = acc.zinliEmail ? `${acc.zinliEmail} **** ${acc.zellePhone}` : '';
          if (acc.method === 'paypal')  map['paypal']       = acc.zelleEmail || '';
        }
        setSavedAccounts(map);
      }
    } catch { /* silencioso */ }
  };

  const loadMethods = async () => {
    try {
      const res = await apiRequest('GET', '/api/digital-payments/methods');
      const data = await res.json();
      if (data.success && data.methods?.length > 0) {
        setMethods(data.methods.filter((m: PaymentMethod) => m.isActive));
      } else {
        // Fallback con los métodos hardcodeados si el endpoint falla
        setMethods([
          { id: '1', name: 'stripe_card',  provider: 'stripe_card',  displayName: 'Tarjeta',    isActive: true, requiresManualVerification: false, instructions: 'Pago seguro con tarjeta via Stripe' },
          { id: '2', name: 'bizum',        provider: 'stripe_bizum', displayName: 'Bizum',       isActive: true, requiresManualVerification: false, instructions: 'Pago instantáneo con Bizum via Stripe' },
          { id: '3', name: 'paypal',       provider: 'paypal',       displayName: 'PayPal',      isActive: true, requiresManualVerification: false, instructions: 'Serás redirigido a PayPal' },
        ]);
      }
    } catch {
      setMethods([
        { id: '1', name: 'stripe_card',  provider: 'stripe_card',  displayName: 'Tarjeta',    isActive: true, requiresManualVerification: false, instructions: 'Pago seguro con tarjeta via Stripe' },
        { id: '2', name: 'bizum',        provider: 'stripe_bizum', displayName: 'Bizum',       isActive: true, requiresManualVerification: false, instructions: 'Pago instantáneo con Bizum via Stripe' },
        { id: '3', name: 'paypal',       provider: 'paypal',       displayName: 'PayPal',      isActive: true, requiresManualVerification: false, instructions: 'Serás redirigido a PayPal' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (selected) {
      (navigation as any).navigate('Checkout', { selectedPaymentMethod: selected });
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={ComeYaColors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Método de pago</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Total */}
      <View style={[styles.totalCard, { backgroundColor: theme.card }, Shadows.sm]}>
        <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>Total a pagar</Text>
        <Text style={[styles.totalAmount, { color: ComeYaColors.primary }]}>
          €{orderTotal.toFixed(2)}
        </Text>
      </View>

      {/* Methods */}
      <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Selecciona tu método de pago</Text>
        {methods.map((method) => {
          const config = METHOD_CONFIG[method.provider] || { icon: 'credit-card', color: ComeYaColors.primary, subtitle: '' };
          const isSelected = selected?.id === method.id;
          return (
            <TouchableOpacity
              key={method.id}
              style={[
                styles.card,
                { backgroundColor: theme.card, borderColor: isSelected ? config.color : theme.border },
                isSelected && { borderWidth: 2 },
                Shadows.sm,
              ]}
              onPress={() => setSelected(method)}
              activeOpacity={0.8}
            >
              <View style={[styles.iconBox, { backgroundColor: config.color + '18' }]}>
                <Feather name={config.icon} size={26} color={config.color} />
              </View>
              <View style={styles.cardInfo}>
                <Text style={[styles.cardName, { color: theme.text }]}>{method.displayName}</Text>
                <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                  {savedAccounts[method.provider] || config.subtitle}
                </Text>
                {savedAccounts[method.provider] && (
                  <Text style={[styles.cardSaved, { color: ComeYaColors.success }]}>✓ Cuenta guardada</Text>
                )}
              </View>
              <View style={[styles.radio, { borderColor: isSelected ? config.color : theme.border, backgroundColor: isSelected ? config.color : 'transparent' }]}>
                {isSelected && <Feather name="check" size={14} color="#FFF" />}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { backgroundColor: theme.card, borderTopColor: theme.border, paddingBottom: insets.bottom + Spacing.md }]}>
        <TouchableOpacity
          style={[styles.continueBtn, { backgroundColor: selected ? ComeYaColors.primary : theme.border }]}
          onPress={handleContinue}
          disabled={!selected}
          activeOpacity={0.85}
        >
          <Text style={styles.continueBtnText}>
            {selected ? `Pagar con ${selected.displayName}` : 'Selecciona un método'}
          </Text>
          {selected && <Feather name="arrow-right" size={20} color="#FFF" />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: { padding: Spacing.xs },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  totalCard: {
    margin: Spacing.lg, padding: Spacing.xl,
    borderRadius: BorderRadius.lg, alignItems: 'center',
  },
  totalLabel: { fontSize: 14, marginBottom: 4 },
  totalAmount: { fontSize: 36, fontWeight: '800' },
  list: { flex: 1, paddingHorizontal: Spacing.lg },
  sectionTitle: { fontSize: 15, fontWeight: '600', marginBottom: Spacing.md },
  card: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.lg, borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md, borderWidth: 1,
  },
  iconBox: {
    width: 52, height: 52, borderRadius: BorderRadius.md,
    alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md,
  },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  cardSub: { fontSize: 13 },
  cardSaved: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  radio: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  footer: {
    padding: Spacing.lg, borderTopWidth: 1,
  },
  continueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: Spacing.lg, borderRadius: BorderRadius.lg, gap: Spacing.sm,
  },
  continueBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
