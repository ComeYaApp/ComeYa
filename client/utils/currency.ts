/**
 * Formatea un valor en euros.
 * @param cents - Valor en centavos de euro (ej: 1050 = €10.50)
 * @param decimals - Decimales a mostrar (default 2)
 */
export const formatCurrency = (cents: number, decimals = 2): string => {
  return `€${(cents / 100).toFixed(decimals)}`;
};

/**
 * Formatea euros directamente (cuando el valor ya está en euros, no centavos)
 */
export const formatEuros = (euros: number, decimals = 2): string => {
  return `€${euros.toFixed(decimals)}`;
};
