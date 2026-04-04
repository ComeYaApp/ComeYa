import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useNavigation } from '@react-navigation/native';
import { ThemedText } from '@/components/ThemedText';
import { ComeYaColors } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface Props {
  route: {
    params: {
      orderId: string;
      paymentUrl: string;
      provider: string;
    };
  };
}

export default function PaymentWebViewScreen({ route }: Props) {
  const { paymentUrl, orderId } = route.params;
  const navigation = useNavigation();
  const { theme } = useTheme();

  useEffect(() => {
    openPayment();
  }, []);

  const openPayment = async () => {
    if (!paymentUrl) {
      navigation.goBack();
      return;
    }

    const result = await WebBrowser.openBrowserAsync(paymentUrl, {
      dismissButtonStyle: 'cancel',
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    });

    // Cuando el usuario cierra el navegador, volver a pedidos
    (navigation as any).reset({
      index: 0,
      routes: [{ name: 'Main' }],
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ActivityIndicator size="large" color={ComeYaColors.primary} />
      <ThemedText type="body" style={{ marginTop: 16, color: theme.textSecondary }}>
        Abriendo pasarela de pago...
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
