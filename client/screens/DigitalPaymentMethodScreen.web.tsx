import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../hooks/useTheme';
import { apiRequest } from '../lib/query-client';
import { ComeYaColors, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { ThemedText } from '@/components/ThemedText';
import { ComeYaLogo } from '@/components/ComeYaLogo';

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
    (navigation as any).navigate('Checkout', {
      selectedPaymentMethod: selected,
      orderType,
      calculatedDeliveryFee,
    });
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

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
              Método de pago
            </ThemedText>
            <ThemedText type="body" style={styles.heroSubtitle}>
              Elige cómo quieres pagar tu pedido de forma segura
            </ThemedText>
          </View>

          {/* Total Card */}
          <View style={styles.heroCard}>
            <View style={styles.heroCardHeader}>
              <Feather name="credit-card" size={24} color={PRIMARY} />
              <ThemedText type="h4" style={{ marginLeft: 12 }}>Total a pagar</ThemedText>
            </View>
            <View style={styles.heroCardDivider} />
            <ThemedText type="h1" style={{ color: PRIMARY, fontSize: 48, fontWeight: "800" }}>
              €{orderTotal.toFixed(2)}
            </ThemedText>
          </View>

          {/* Security Badges */}
          <View style={styles.securityContainer}>
            <View style={styles.securityBadge}>
              <Feather name="shield" size={20} color="rgba(255,255,255,0.9)" />
              <ThemedText type="small" style={{ color: "rgba(255,255,255,0.9)", marginLeft: 8 }}>
                Pago 100% seguro
              </ThemedText>
            </View>
            <View style={styles.securityBadge}>
              <Feather name="lock" size={20} color="rgba(255,255,255,0.9)" />
              <ThemedText type="small" style={{ color: "rgba(255,255,255,0.9)", marginLeft: 8 }}>
                Datos encriptados
              </ThemedText>
            </View>
            <View style={styles.securityBadge}>
              <Feather name="check-circle" size={20} color="rgba(255,255,255,0.9)" />
              <ThemedText type="small" style={{ color: "rgba(255,255,255,0.9)", marginLeft: 8 }}>
                Sin cargos ocultos
              </ThemedText>
            </View>
          </View>
        </View>
      </View>

      {/* RIGHT: Methods Section */}
      <View style={styles.methodsSection}>
        <ScrollView 
          style={styles.methodsScrollView}
          contentContainerStyle={styles.methodsScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.methodsCard}>
            <ThemedText type="h3" style={{ marginBottom: 24, color: "#1F2937" }}>
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
    flexWrap: "wrap" as any,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
    alignItems: "center",
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
    marginBottom: 24,
    width: "100%",
  },
  securityContainer: {
    gap: 16,
  },
  securityBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  // RIGHT: Methods Section
  methodsSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 48,
  },
  methodsScrollView: {
    flex: 1,
    width: "100%",
  },
  methodsScrollContent: {
    alignItems: "center",
    paddingVertical: 48,
  },
  methodsCard: {
    width: "100%",
    maxWidth: 600,
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 48,
    ...Platform.select({
      web: {
        boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
      },
    }),
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
