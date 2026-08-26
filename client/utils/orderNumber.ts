/**
 * Número público del pedido con formato #CY000001 (secuencial desde la
 * primera transacción). Fallback al ID corto para pedidos históricos.
 */
export function displayOrderNumber(order: any): string {
  const n = Number(order?.orderNumber);
  if (Number.isFinite(n) && n > 0) {
    return `#CY${String(Math.trunc(n)).padStart(6, "0")}`;
  }
  const id = String(order?.id ?? "");
  return id ? `#${id.slice(-6).toUpperCase()}` : "#—";
}

/** Solo el número formateado sin '#', para textos tipo "Pedido CY000123". */
export function orderNumberLabel(order: any): string {
  return displayOrderNumber(order).replace(/^#/, "");
}
