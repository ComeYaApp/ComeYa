// Shim web de @stripe/stripe-react-native: en el navegador no existe el
// módulo nativo de Stripe. Los pagos Stripe en web se gestionan por otras
// vías (StripePaymentScreen.web / redirecciones). Este stub evita que Metro
// falle al resolver el paquete nativo en el bundle web.
const noop = () => Promise.resolve({ error: undefined });

export const initStripe = () => Promise.resolve();
export const useStripe = () => ({});
export const StripeProvider = ({ children }) => children;
export const presentPaymentSheet = noop;
export const confirmPaymentSheetPayment = noop;
export const confirmPayment = noop;
export const createPaymentMethod = noop;
export const retrievePaymentIntent = noop;
export const PlatformPay = { isPlatformPaySupported: noop };

export default {
  initStripe,
  useStripe,
  StripeProvider,
  presentPaymentSheet,
  confirmPaymentSheetPayment,
  confirmPayment,
  createPaymentMethod,
  retrievePaymentIntent,
  PlatformPay,
};
