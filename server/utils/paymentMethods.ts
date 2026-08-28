/**
 * Fusión de la lista de métodos de pago que ve el cliente.
 *
 * Fuente 1: filas activas de la tabla payment_methods.
 * Fuente 2: cuentas receptoras configuradas (bizum/IBAN/PayPal).
 *
 * Problema que resuelve: el cliente (nativo y web) añade por su cuenta los
 * métodos manuales cuando la cuenta receptora existe, saltándose los que
 * ya vienen en la lista SI el provider coincide exactamente ("sepa",
 * "bizum_manual", "paypal"). Si la fila de BD usa otra grafía
 * ("sepa_debit", "bank_transfer", "bizum"...), el anti-duplicados del
 * cliente no la reconoce y muestra la opción DOS veces.
 *
 * Esta fusión devuelve siempre los providers canónicos exactos, de modo
 * que las apps YA instaladas dejan de duplicar por sí solas.
 */

export interface ReceivingAccounts {
  bizum?: string | null;
  iban?: string | null;
  paypalEmail?: string | null;
}

export interface PaymentMethodLike {
  id?: string;
  name?: string;
  provider: string;
  displayName: string;
  isActive?: boolean | null;
  requiresManualVerification?: boolean | null;
  commissionPercentage?: any;
  iconUrl?: string | null;
  instructions?: string | null;
  [key: string]: any;
}

const MANUAL_LABELS: Record<string, string> = {
  bizum_manual: "Bizum (manual)",
  sepa: "Transferencia SEPA",
  paypal: "PayPal",
};

/** Providers canónicos de los métodos manuales. */
export const MANUAL_PROVIDERS = ["bizum_manual", "sepa", "paypal"] as const;

/** Normaliza un provider a su forma canónica manual (o null si no es manual). */
export function canonicalizeProvider(provider: string): string | null {
  const k = String(provider || "")
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  if (!k) return null;
  if (k.includes("sepa") || k.includes("transferencia") || k.includes("banktransfer")) {
    return "sepa";
  }
  if (k === "bizum" || k.includes("bizummanual")) return "bizum_manual";
  if (k === "paypal") return "paypal";
  return null;
}

/**
 * Fusiona filas de payment_methods + cuentas receptoras en una lista sin
 * duplicados y con providers canónicos. Pura: no toca la BD.
 */
export function mergePaymentMethods(
  rows: PaymentMethodLike[],
  receiving: ReceivingAccounts | null | undefined,
): PaymentMethodLike[] {
  const out = new Map<string, PaymentMethodLike>();

  for (const row of rows) {
    if (row && row.isActive === false) continue;
    const canon = canonicalizeProvider(row.provider);
    const key = canon ?? String(row.provider || "").toLowerCase();
    if (out.has(key)) continue;
    if (canon) {
      out.set(key, {
        ...row,
        provider: canon,
        requiresManualVerification: true,
        displayName: MANUAL_LABELS[canon] || row.displayName,
      });
    } else {
      out.set(key, row);
    }
  }

  const addManual = (key: string, instructions: string) => {
    const existing = out.get(key);
    if (existing) {
      if (!existing.instructions) existing.instructions = instructions;
      return;
    }
    out.set(key, {
      id: key,
      name: key,
      provider: key,
      displayName: MANUAL_LABELS[key] ?? key,
      isActive: true,
      requiresManualVerification: true,
      instructions,
    });
  };

  if (receiving?.bizum) addManual("bizum_manual", `Envía al ${receiving.bizum}`);
  if (receiving?.iban) addManual("sepa", `IBAN: ${receiving.iban}`);
  if (receiving?.paypalEmail) {
    addManual("paypal", `Envía a ${receiving.paypalEmail}`);
  }

  return [...out.values()];
}
