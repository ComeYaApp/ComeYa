// Configuración global de ComeYa — todos los valores de negocio en un solo lugar

const commission = parseFloat(process.env.NEMY_COMMISSION || "15") / 100; // 0.15
const driverCommission = parseFloat(process.env.DRIVER_COMMISSION || "100") / 100;
const businessCommission = parseFloat(process.env.BUSINESS_COMMISSION || "100") / 100;

export const CONFIG = {
  // Comisiones
  COMEYA_COMMISSION: commission,           // 0.15 (15%)
  COMEYA_COMMISSION_DIVISOR: 1 + commission, // 1.15
  DRIVER_COMMISSION: driverCommission,
  BUSINESS_COMMISSION: businessCommission,

  // Delivery
  DEFAULT_DELIVERY_FEE: 300,              // €3.00 en céntimos
  DEFAULT_DELIVERY_TIME: "30-45 min",

  // Pedidos
  REGRET_PERIOD_SECONDS: parseInt(process.env.REGRET_PERIOD_SECONDS || "60"),
  FUND_HOLD_HOURS: parseInt(process.env.FUND_HOLD_HOURS || "1"),

  // Efectivo
  MAX_CASH_OWED: parseInt(process.env.MAX_CASH_OWED || "50000"),
  LIQUIDATION_DEADLINE_DAYS: parseInt(process.env.LIQUIDATION_DEADLINE_DAYS || "7"),
  WARNING_THRESHOLD_DAYS: parseInt(process.env.WARNING_THRESHOLD_DAYS || "5"),

  // Cuenta receptora ComeYa
  BIZUM_PHONE: process.env.COMEYA_BIZUM_PHONE || process.env.MOUZO_PAGO_MOVIL_PHONE || "600000000",
  IBAN: process.env.COMEYA_IBAN || "ES00 0000 0000 0000 0000 0000",
  PAYPAL_EMAIL: process.env.COMEYA_PAYPAL_EMAIL || "pagos@comeya.es",
};
