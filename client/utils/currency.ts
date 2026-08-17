/**
 * Utilidades de moneda — estándar español: "15,30 €"
 * (importe primero, coma decimal, punto de miles, símbolo después).
 */

const esNumber = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formatea un valor en céntimos de euro (ej: 1050 → "10,50 €").
 */
export const formatCurrency = (cents: number, decimals = 2): string => {
  if (cents === null || cents === undefined || Number.isNaN(cents)) {
    return "0,00 €";
  }
  const value = cents / 100;
  if (decimals !== 2) {
    return `${value.toLocaleString("es-ES", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })} €`;
  }
  return `${esNumber.format(value)} €`;
};

/**
 * Formatea euros directamente (cuando el valor ya está en euros, no céntimos).
 */
export const formatEuros = (euros: number, decimals = 2): string => {
  if (euros === null || euros === undefined || Number.isNaN(euros)) {
    return "0,00 €";
  }
  return `${euros.toLocaleString("es-ES", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} €`;
};

/**
 * Formatea una cantidad SIN el símbolo (ej: "15,30").
 */
export const formatAmount = (value: number, decimals = 2): string =>
  value.toLocaleString("es-ES", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
