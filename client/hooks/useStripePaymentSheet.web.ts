// Web stub — Payment Sheet no disponible en web
export function useStripePaymentSheet() {
  const presentPaymentSheet = async () => ({
    success: false,
    error: 'Pago con tarjeta no disponible en web. Descarga la app.',
  });

  return { presentPaymentSheet, loading: false };
}
