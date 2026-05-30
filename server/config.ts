// Configuración global de ComeYa — lee de system_settings en la BD
// El admin edita estos valores desde su panel sin tocar código ni .env

let cache: Record<string, string> = {};
let cacheExpiry = 0;
const CACHE_TTL = 60 * 1000; // 1 minuto

async function getSettings(): Promise<Record<string, string>> {
  if (Date.now() < cacheExpiry && Object.keys(cache).length > 0) return cache;
  try {
    const { db } = await import("./db");
    const { systemSettings } = await import("../shared/schema-mysql");
    const rows = await db.select().from(systemSettings);
    cache = {};
    for (const row of rows) cache[row.key] = row.value;
    cacheExpiry = Date.now() + CACHE_TTL;
  } catch {
    // Si falla la BD usar valores por defecto
  }
  return cache;
}

async function get(key: string, def: string): Promise<string> {
  const s = await getSettings();
  return s[key] ?? def;
}

async function getNum(key: string, def: number): Promise<number> {
  const v = await get(key, String(def));
  const n = parseFloat(v);
  return isNaN(n) ? def : n;
}

export const CONFIG = {
  // Comisiones — key existente en BD: "comeya_commission_pct" o "nemy_commission"
  async commission() {
    return (await getNum("comeya_commission_pct", 15)) / 100;
  },
  async commissionDivisor() {
    return 1 + (await CONFIG.commission());
  },

  // Delivery
  async deliveryFee() {
    return getNum("default_delivery_fee_cents", 300);
  },
  async deliveryTime() {
    return get("default_delivery_time", "30-45 min");
  },

  // Datos de pago ComeYa — editables por el admin desde el panel
  async bizumPhone() {
    return get("comeya_bizum_phone", "600 000 000");
  },
  async iban() {
    return get("comeya_iban", "ES00 0000 0000 0000 0000 0000");
  },
  async paypalEmail() {
    return get("comeya_paypal_email", "pagos@comeya.es");
  },
  async titular() {
    return get("comeya_titular", "ComeYa S.L.");
  },
  async banco() {
    return get("comeya_banco", "Banco Santander");
  },
};

export function invalidateSettingsCache() {
  cache = {};
  cacheExpiry = 0;
}
