import React, { useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { ComeYaLogo } from '@/components/ComeYaLogo';
import { apiRequest } from '@/lib/query-client';
import { useToast } from '@/contexts/ToastContext';

const PRIMARY = "#DC2626";

export default function StripePaymentScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const params = route.params as any;
  const { orderId, amount, subtotal, deliveryFee, businessId } = params || {};

  const handlePayment = async () => {
    setLoading(true);
    try {
      // Simular pago exitoso por ahora
      // En producción, aquí integrarías Stripe.js
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      showToast('Pago procesado exitosamente', 'success');
      
      navigation.reset({
        index: 0,
        routes: [
          { name: 'Main' as never },
          { name: 'OrderTracking' as never, params: { orderId } },
        ],
      });
    } catch (error) {
      showToast('Error al procesar el pago', 'error');
      setLoading(false);
    }
  };

  return (
    <View style={[styles.webContainer, { backgroundColor: theme.backgroundRoot }]}>
      {/* LEFT: Hero Section */}
      <View style={styles.heroSection}>
        <View style={styles.heroContent}>
          <Pressable onPress={() => navigation.goBack()} style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <ComeYaLogo size={48} />
            </View>
            <ThemedText type="h2" style={styles.logoText}>ComeYa</ThemedText>
          </Pressable>

          <View style={styles.heroTextContainer}>
            <ThemedText type="h1" style={styles.heroTitle}>
              Pago seguro
            </ThemedText>
            <ThemedText type="body" style={styles.heroSubtitle}>
              Completa tu pago de forma segura con Stripe
            </ThemedText>
          </View>

          <View style={styles.heroCard}>
            <View style={styles.heroCardHeader}>
              <Feather name="credit-card" size={24} color={PRIMARY} />
              <ThemedText type="h4" style={{ marginLeft: 12 }}>Total a pagar</ThemedText>
            </View>
            <View style={styles.heroCardDivider} />
            <ThemedText type="h1" style={{ color: PRIMARY, fontSize: 48, fontWeight: "800" }}>
              €{(amount / 100).toFixed(2)}
            </ThemedText>
          </View>

          <View style={styles.securityBadges}>
            <View style={styles.securityBadge}>
              <Feather name="shield" size={20} color="rgba(255,255,255,0.9)" />
              <ThemedText type="small" style={{ color: "rgba(255,255,255,0.9)", marginLeft: 8 }}>
                Pago 100% seguro
              </ThemedText>
            </View>
            <View style={styles.securityBadge}>
              <Feather name="lock" size={20} color="rgba(255,255,255,0.9)" />
              <ThemedText type="small" style={{ color: "rgba(255,255,255,0.9)", marginLeft: 8 }}>
                Encriptación SSL
              </ThemedText>
            </View>
          </View>
        </View>
      </View>

      {/* RIGHT: Payment Form */}
      <View style={styles.formSection}>
        <View style={[styles.formCard, { backgroundColor: theme.card }]}>
          <ThemedText type="h3" style={{ marginBottom: 24 }}>
            Información de pago
          </ThemedText>

          {/* Placeholder para Stripe Elements */}
          <View style={styles.stripeContainer}>
            <View style={[styles.stripeElement, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="credit-card" size={20} color={theme.textSecondary} />
              <ThemedText type="body" style={{ color: theme.textSecondary, marginLeft: 12 }}>
                Número de tarjeta
              </ThemedText>
            </View>
            
            <View style={styles.stripeRow}>
              <View style={[styles.stripeElement, styles.stripeHalf, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="calendar" size={20} color={theme.textSecondary} />
                <ThemedText type="body" style={{ color: theme.textSecondary, marginLeft: 12 }}>
                  MM/AA
                </ThemedText>
              </View>
              <View style={[styles.stripeElement, styles.stripeHalf, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="lock" size={20} color={theme.textSecondary} />
                <ThemedText type="body" style={{ color: theme.textSecondary, marginLeft: 12 }}>
                  CVC
                </ThemedText>
              </View>
            </View>
          </View>

          <View style={[styles.infoBox, { backgroundColor: PRIMARY + "10", borderColor: PRIMARY + "30" }]}>
            <Feather name="info" size={20} color={PRIMARY} />
            <ThemedText type="small" style={{ color: PRIMARY, marginLeft: 12, flex: 1 }}>
              Integración de Stripe en desarrollo. Por ahora, usa métodos de pago manuales (Bizum, SEPA, PayPal).
            </ThemedText>
          </View>

          <Pressable
            onPress={handlePayment}
            disabled={loading}
            style={[styles.payButton, loading && { opacity: 0.6 }]}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Feather name="lock" size={20} color="#FFF" />
                <ThemedText type="h4" style={{ color: "#FFF", marginLeft: 12, fontWeight: "600" }}>
                  Pagar €{(amount / 100).toFixed(2)}
                </ThemedText>
              </>
            )}
          </Pressable>

          <Pressable onPress={() => navigation.goBack()} style={styles.cancelButton}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Cancelar y volver
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
    flexDirection: "row",
  },
  heroSection: {
    flex: 1,
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
  securityBadges: {
    gap: 16,
  },
  securityBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  formSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 48,
  },
  formCard: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 24,
    padding: 48,
    ...Platform.select({
      web: {
        boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
      },
    }),
  },
  stripeContainer: {
    marginBottom: 24,
  },
  stripeElement: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  stripeRow: {
    flexDirection: "row",
    gap: 16,
  },
  stripeHalf: {
    flex: 1,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  payButton: {
    height: 56,
    backgroundColor: PRIMARY,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    ...Platform.select({
      web: {
        boxShadow: "0 4px 12px rgba(220, 38, 38, 0.3)",
      },
    }),
  },
  cancelButton: {
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
});
