import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../hooks/useTheme';
import { apiRequest } from '../lib/query-client';
import { ComeYaColors, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { ThemedText } from '@/components/ThemedText';
import { WebLayout } from '@/components/WebLayout';
import { useResponsive } from '@/hooks/useResponsive';

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
  route?: { params?: { orderTotal?: number; orderType?: 'delivery' | 'pickup'; calculatedDeliveryFee?: number } };
}

const METHOD_CONFIG: Record<string, { icon: any; color: string; subtitle: string; manual?: boolean }> = {
  stripe_card:  { icon: 'credit-card', color: '#635BFF', subtitle: 'Visa, Mastercard, Amex' },
  stripe_bizum: { icon: 'smartphone',  color: '#00ADEF', subtitle: 'Pago instantáneo desde tu móvil' },
  bizum_manual: { icon: 'smartphone',  color: '#00ADEF', subtitle: 'Transferencia manual con comprobante', manual: true },
  sepa:         { icon: 'credit-card', color: '#1A56DB', subtitle: 'Transferencia bancaria SEPA', manual: true },
  paypal:       { icon: 'dollar-sign', color: '#003087', subtitle: 'Envía desde tu cuenta PayPal', manual: true },
};

const PRIMARY = "#DC2626";

export default function DigitalPaymentMethodScreen({ route }: Props) {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PaymentMethod | null>(null);
  const [savedAccounts, setSavedAccounts] = useState<Record<string, string>>({});
  const [pendingDefault, setPendingDefault] = useState<string | null>(null);
  const [receivingInfo, setReceivingInfo] = useState<any>(null);
  const orderTotal = route?.params?.orderTotal || 0;
  const orderType = route?.params?.orderType || 'delivery';
  const calculatedDeliveryFee = route?.params?.calculatedDeliveryFee;
  const { isMobile } = useResponsive();

  useEffect(() => { loadMethods(); loadSavedAccounts(); }, []);

  useEffect(() => {
    if (pendingDefault && methods.length > 0) {
      const match = methods.find(m => m.provider === pendingDefault);
      if (match) setSelected(match);
      setPendingDefault(null);
    }
  }, [pendingDefault, methods]);

  useEffect(() => {
    if (!receivingInfo) return;
    setMethods(prev => {
      const manual: PaymentMethod[] = [];
      if (receivingInfo.bizum && !prev.find(m => m.provider === 'bizum_manual')) {
        manual.push({ id: 'bm', name: 'bizum_manual', provider: 'bizum_manual', displayName: 'Bizum (manual)', isActive: true, requiresManualVerification: true, instructions: `Envía al ${receivingInfo.bizum}` });
      }
      if (receivingInfo.iban && !prev.find(m => m.provider === 'sepa')) {
        manual.push({ id: 'sp', name: 'sepa', provider: 'sepa', displayName: 'Transferencia SEPA', isActive: true, requiresManualVerification: true, instructions: `IBAN: ${receivingInfo.iban}` });
      }
      if (receivingInfo.paypalEmail && !prev.find(m => m.provider === 'paypal')) {
        manual.push({ id: 'pp', name: 'paypal', provider: 'paypal', displayName: 'PayPal', isActive: true, requiresManualVerification: true, instructions: `Envía a ${receivingInfo.paypalEmail}` });
      }
      return [...prev, ...manual];
    });
  }, [receivingInfo]);

  const loadSavedAccounts = async () => {
    try {
      const res = await apiRequest('GET', '/api/payouts/accounts');
      const data = await res.json();
      if (data.success && data.accounts) {
        const map: Record<string, string> = {};
        let defaultMethod: string | null = null;
        for (const acc of data.accounts) {
          if (acc.method === 'bizum')        { map['stripe_bizum'] = acc.pagoMovilPhone || ''; }
          if (acc.method === 'tarjeta')      { map['stripe_card']  = acc.zinliEmail ? `${acc.zinliEmail} **** ${acc.zellePhone}` : ''; }
          if (acc.method === 'paypal')       { map['paypal']       = acc.zelleEmail || ''; }
          if (acc.isDefault && !defaultMethod) {
            if (acc.method === 'bizum')   defaultMethod = 'stripe_bizum';
            if (acc.method === 'tarjeta') defaultMethod = 'stripe_card';
            if (acc.method === 'paypal')  defaultMethod = 'paypal';
          }
        }
        setSavedAccounts(map);
        if (defaultMethod) setPendingDefault(defaultMethod);
      }

      const infoRes = await apiRequest('GET', '/api/payments/info');
      const infoData = await infoRes.json();
      if (infoData.success) {
        setReceivingInfo(infoData);
      }
    } catch { /* silencioso */ }
  };

  const loadMethods = async () => {
    try {
      const res = await apiRequest('GET', '/api/digital-payments/methods');
      const data = await res.json();
      let activeMethods: PaymentMethod[] = [];
      if (data.success && data.methods?.length > 0) {
        activeMethods = data.methods.filter((m: PaymentMethod) => m.isActive);
      } else {
        activeMethods = [
          { id: '1', name: 'stripe_card',  provider: 'stripe_card',  displayName: 'Tarjeta',    isActive: true, requiresManualVerification: false, instructions: 'Visa, Mastercard, Amex — pago instantáneo' },
          { id: '2', name: 'stripe_bizum', provider: 'stripe_bizum', displayName: 'Bizum',       isActive: true, requiresManualVerification: false, instructions: 'Pago instantáneo desde tu móvil' },
        ];
      }
      setMethods(activeMethods);
      if (pendingDefault && activeMethods.length > 0) {
        const match = activeMethods.find(m => m.provider === pendingDefault);
        if (match) setSelected(match);
        setPendingDefault(null);
      }
    } catch {
      setMethods([
        { id: '1', name: 'stripe_card',  provider: 'stripe_card',  displayName: 'Tarjeta',    isActive: true, requiresManualVerification: false, instructions: 'Visa, Mastercard, Amex' },
        { id: '2', name: 'stripe_bizum', provider: 'stripe_bizum', displayName: 'Bizum',       isActive: true, requiresManualVerification: false, instructions: 'Pago instantáneo' },
      ]);
    } finally {
      setLoading(false);
    }
  };

const handleContinue = () => {
    if (!selected) return;
    
    // Para métodos manuales (bizum, sepa, paypal), ir a PaymentProof para subir comprobante
    if (selected.requiresManualVerification) {
      const amount = orderTotal * 100; // convert to cents
      const shortId = Date.now().toString(36).toUpperCase();
      (navigation as any).navigate('PaymentProof', {
        orderId: shortId,
        amount,
        paymentMethod: selected.provider.includes('sepa') ? 'sepa' : selected.provider.includes('paypal') ? 'paypal' : 'bizum',
      });
      return;
    }
    
    // Para Stripe (tarjeta/bizum instantáneo), ir a Checkout
    (navigation as any).navigate('Checkout', {
      selectedPaymentMethod: selected,
      orderType,
      calculatedDeliveryFee,
    });
  };

  const { isDark } = useTheme();
  const bg     = isDark ? '#111' : '#f7f7f7';
  const border = isDark ? '#333' : '#e8e8e8';

  if (loading) {
    return (
      <WebLayout>
        <View style={[styles.center, { backgroundColor: bg }]}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      </WebLayout>
    );
  }

  return (
    <WebLayout>
    <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={styles.pageContent}>
      {/* Header */}
      <View style={[styles.pageHeader, { borderBottomColor: border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={isDark ? '#fff' : '#1a1a1a'} />
        </Pressable>
        <ThemedText type="h3">Método de pago</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.centerWrap}>
        <View style={[styles.methodsCard, { backgroundColor: isDark ? '#1e1e1e' : '#fff' }]}>
            <ThemedText type="h3" style={{ marginBottom: 24 }}>
              Selecciona tu método de pago
            </ThemedText>

            {methods.map((method) => {
              const config = METHOD_CONFIG[method.provider] || { icon: 'credit-card', color: PRIMARY, subtitle: '' };
              const isSelected = selected?.id === method.id;
              return (
                <Pressable
                  key={method.id}
                  style={[
                    styles.methodCard,
                    isSelected && { borderColor: config.color, borderWidth: 2 },
                  ]}
                  onPress={() => setSelected(method)}
                >
                  <View style={[styles.methodIcon, { backgroundColor: config.color + '18' }]}>
                    <Feather name={config.icon} size={28} color={config.color} />
                  </View>
                  <View style={styles.methodInfo}>
                    <ThemedText type="h4" style={{ marginBottom: 4 }}>
                      {method.displayName}
                    </ThemedText>
                    <ThemedText type="small" style={{ color: "#6B7280", marginBottom: 4 }}>
                      {savedAccounts[method.provider] || config.subtitle}
                    </ThemedText>
                    {savedAccounts[method.provider] && (
                      <View style={styles.savedBadge}>
                        <Feather name="check-circle" size={12} color="#059669" />
                        <ThemedText type="small" style={{ color: "#059669", marginLeft: 4, fontWeight: "600" }}>
                          Cuenta guardada
                        </ThemedText>
                      </View>
                    )}
                    {config.manual && (
                      <View style={styles.manualBadge}>
                        <Feather name="camera" size={12} color="#F59E0B" />
                        <ThemedText type="small" style={{ color: "#F59E0B", marginLeft: 4, fontWeight: "600" }}>
                          Requiere comprobante
                        </ThemedText>
                      </View>
                    )}
                  </View>
                  <View style={[styles.radio, isSelected && { borderColor: config.color, backgroundColor: config.color }]}>
                    {isSelected && <Feather name="check" size={16} color="#FFF" />}
                  </View>
                </Pressable>
              );
            })}

            {/* Continue Button */}
            <Pressable
              onPress={handleContinue}
              disabled={!selected}
              style={[styles.continueButton, !selected && { opacity: 0.5 }]}
            >
              <ThemedText type="h4" style={{ color: "#FFF", fontWeight: "600" }}>
                {selected ? `Pagar con ${selected.displayName}` : 'Selecciona un método'}
              </ThemedText>
              {selected && <Feather name="arrow-right" size={20} color="#FFF" style={{ marginLeft: 12 }} />}
            </Pressable>
          </View>
      </View>
    </ScrollView>
    </WebLayout>
  );
}

const styles = StyleSheet.create({
  pageContent:  { flexGrow: 1 },
  pageHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn:      { width: 40, height: 40, justifyContent: 'center' },
  centerWrap:   { flex: 1, alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16 },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  methodsCard: {
    width: '100%',
    maxWidth: 600,
    borderRadius: 16,
    padding: 32,
    ...Platform.select({ web: { boxShadow: '0 4px 20px rgba(0,0,0,0.08)' } }),
  },
  methodCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  methodIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  methodInfo: {
    flex: 1,
  },
  savedBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  manualBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  radio: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PRIMARY,
    height: 56,
    borderRadius: 16,
    marginTop: 24,
    ...Platform.select({
      web: {
        boxShadow: "0 4px 12px rgba(220, 38, 38, 0.3)",
      },
    }),
  },
});
