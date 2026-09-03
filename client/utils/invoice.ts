/**
 * Factura simple descargable por pedido (nº #CY, desglose completo).
 * - Web: ventana de impresión del navegador → "Guardar como PDF".
 * - Nativo: expo-print genera el PDF y expo-sharing lo comparte/guarda.
 */

function safeParse(v: any): any {
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return [];
    }
  }
  return Array.isArray(v) ? v : [];
}

function cents(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function eur(c: number): string {
  return `${(c / 100).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}

export function orderInvoiceNumber(order: any): string {
  const n = Number(order?.orderNumber);
  if (Number.isFinite(n) && n > 0)
    return `#CY${String(Math.trunc(n)).padStart(6, "0")}`;
  return `#${String(order?.id ?? "").slice(-6).toUpperCase()}`;
}

export function buildInvoiceHtml(order: any): string {
  const items = safeParse(order?.items);
  const subtotal = cents(order?.subtotal);
  const deliveryFee = cents(order?.deliveryFee ?? order?.delivery_fee);
  const tip = cents(order?.tipAmount ?? order?.tip_amount);
  const discount =
    cents(order?.couponDiscount ?? order?.coupon_discount) +
    cents(order?.subDiscount ?? order?.sub_discount);
  const total = cents(order?.total);

  const rows = items
    .map((it: any) => {
      const qty = Number(it?.quantity) || 1;
      const price = cents(it?.price ?? it?.product?.price);
      const note = it?.note ? `<div class="note">Nota: ${it.note}</div>` : "";
      return `<tr>
        <td>${qty}× ${it?.name || it?.product?.name || "Producto"}${note}</td>
        <td class="num">${eur(price * qty)}</td>
      </tr>`;
    })
    .join("");

  const paymentLabels: Record<string, string> = {
    stripe_card: "Tarjeta (Stripe)",
    stripe_bizum: "Bizum (Stripe)",
    cash: "Efectivo",
    efectivo: "Efectivo",
    bizum_manual: "Bizum (comprobante)",
    paypal: "PayPal (comprobante)",
    sepa: "Transferencia SEPA",
  };

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Factura ${orderInvoiceNumber(order)}</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Arial, sans-serif; color: #111; padding: 40px; max-width: 720px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .muted { color: #666; font-size: 13px; }
  .header { display: flex; justify-content: space-between; border-bottom: 2px solid #E60000; padding-bottom: 16px; margin-bottom: 24px; }
  .right { text-align: right; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th { text-align: left; font-size: 12px; text-transform: uppercase; color: #666; padding: 8px 4px; border-bottom: 1px solid #ddd; }
  td { padding: 8px 4px; border-bottom: 1px solid #eee; font-size: 14px; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  .note { color: #B45309; font-size: 12px; margin-top: 2px; }
  .totals { margin-left: auto; width: 260px; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px; }
  .grand { font-weight: 700; font-size: 16px; border-top: 2px solid #111; margin-top: 8px; padding-top: 8px; }
  .footer { margin-top: 40px; border-top: 1px solid #ddd; padding-top: 12px; font-size: 12px; color: #888; }
</style></head><body>
  <div class="header">
    <div>
      <h1>🛵 ComeYa — Factura</h1>
      <div class="muted">Factura ${orderInvoiceNumber(order)}</div>
      <div class="muted">${order?.businessName || "ComeYa"}</div>
    </div>
    <div class="right">
      <div class="muted">Fecha: ${new Date(order?.createdAt).toLocaleString("es-ES")}</div>
      <div class="muted">Pago: ${paymentLabels[order?.paymentMethod] || order?.paymentMethod || "—"}</div>
      ${order?.orderType === "pickup" ? '<div class="muted">Recogida en local</div>' : ""}
    </div>
  </div>

  <div class="muted">Cliente: ${order?.customer?.name || order?.customerName || "—"}</div>
  <div class="muted" style="margin-top:4px">Entrega: ${order?.deliveryAddress || "Recogida en local"}</div>

  <table>
    <thead><tr><th>Producto</th><th class="num">Importe</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div><span>Subtotal</span><span>${eur(subtotal)}</span></div>
    ${deliveryFee > 0 ? `<div><span>Envío</span><span>${eur(deliveryFee)}</span></div>` : ""}
    ${tip > 0 ? `<div><span>Propina repartidor</span><span>${eur(tip)}</span></div>` : ""}
    ${discount > 0 ? `<div><span>Descuentos</span><span>−${eur(discount)}</span></div>` : ""}
    <div class="grand"><span>Total</span><span>${eur(total)}</span></div>
  </div>

  <div class="footer">
    ComeYa · Soporte: soporte@comeya.es · Gracias por tu pedido.
  </div>
</body></html>`;
}

/** Imprimir/guardar PDF en WEB (ventana del navegador → Guardar como PDF). */
export function printInvoiceWeb(order: any): void {
  const w = window.open("", "_blank", "width=820,height=900");
  if (!w) return;
  w.document.write(buildInvoiceHtml(order));
  w.document.close();
  w.focus();
  setTimeout(() => {
    try {
      w.print();
    } catch {}
  }, 350);
}

/** Generar y compartir/guardar el PDF en NATIVO (expo-print + expo-sharing). */
export async function printInvoiceNative(order: any): Promise<boolean> {
  try {
    const Print = await import("expo-print");
    const Sharing = await import("expo-sharing");
    const { uri } = await Print.printToFileAsync({
      html: buildInvoiceHtml(order),
    });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: `Factura ${orderInvoiceNumber(order)}`,
      });
    }
    return true;
  } catch {
    return false;
  }
}
