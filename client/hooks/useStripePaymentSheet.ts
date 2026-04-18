import { useState } from 'react';
import { Platform } from 'react-native';
import { apiRequest } from '@/lib/query-client';

interface PaymentSheetParams {
  orderId: string;
  amount: number;
  subtotal: number;
  deliveryFee: number;
  businessId: string;
}

interface PaymentSheetResult {
  success: boolean;
  error?: string;
}

export function useStripePaymentSheet() {
  const [loading, setLoading] = useState(false);

  const presentPaymentSheet = async (params: PaymentSheetParams): Promise<PaymentSheetResult> => {
    // No disponible en web
    if (typeof Platform === 'undefined' || Platform.OS === 'web') {
      return { success: false, error: 'Payment Sheet no disponible en web' };
    }

    setLoading(true);
    try {
      const res = await apiRequest('POST', '/api/stripe/create-payment-sheet', {
        orderId: params.orderId,
        amount: params.amount,
        subtotal: params.subtotal,
        deliveryFee: params.deliveryFee,
        businessId: params.businessId,
      });
      const data = await res.json();

      if (!data.paymentIntent || !data.ephemeralKey || !data.customer) {
        return { success: false, error: data.error || 'Error al inicializar el pago' };
      }

      const StripeModule = await import('@stripe/stripe-react-native');

      const { error: initError } = await StripeModule.initPaymentSheet({
        merchantDisplayName: 'ComeYa',
        customerId: data.customer,
        customerEphemeralKeySecret: data.ephemeralKey,
        paymentIntentClientSecret: data.paymentIntent,
        allowsDelayedPaymentMethods: false,
        defaultBillingDetails: { address: { country: 'ES' } },
        appearance: {
          colors: {
            primary: '#FF6B35',
            background: '#FFFFFF',
            componentBackground: '#F7F7F7',
            componentBorder: '#E0E0E0',
            componentDivider: '#E0E0E0',
            primaryText: '#1A1A1A',
            secondaryText: '#555555',
            componentText: '#1A1A1A',
            placeholderText: '#AAAAAA',
          },
        },
      });

      if (initError) return { success: false, error: initError.message };

      const { error: presentError } = await StripeModule.presentPaymentSheet();

      if (presentError) {
        if (presentError.code === 'Canceled') return { success: false, error: 'Pago cancelado' };
        return { success: false, error: presentError.message };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  return { presentPaymentSheet, loading };
}
