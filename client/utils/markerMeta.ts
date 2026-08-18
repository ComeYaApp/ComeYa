/**
 * Metadatos de marcadores de mapa compartidos (nativo + web).
 *
 * Define qué icono y color usa cada rol en el mapa, estilo Uber/Rappi:
 * - Negocio: icono según TIPO de comercio (pizza, sushi, mercado, farmacia…)
 * - Repartidor: icono según su VEHÍCULO (bici, moto, coche)
 * - Cliente: casa azul
 */

export interface MarkerMeta {
  icon: string; // nombre MaterialCommunityIcons (nativo) / clave de path (web)
  color: string;
}

// ─── NEGOCIOS ────────────────────────────────────────────────────────────────

const CATEGORY_RULES: { match: RegExp; icon: string; color: string }[] = [
  // Comida por categoría (categories es un string separado por comas)
  { match: /pizza/i, icon: "pizza", color: "#F97316" },
  { match: /burger|hamburgues/i, icon: "hamburger", color: "#F59E0B" },
  { match: /sushi|japon|japones/i, icon: "fish", color: "#6366F1" },
  { match: /ramen|noodle|fideo|pasta|italian/i, icon: "noodles", color: "#8B5CF6" },
  { match: /marisc|pescad|seafood|fish/i, icon: "fish", color: "#0EA5E9" },
  { match: /pollo|chicken|asado|parrill|kebab/i, icon: "food", color: "#D97706" },
  { match: /taco|mexic|burrito/i, icon: "food", color: "#F59E0B" },
  { match: /cafe|cafeter|desayun|breakfast|brunch/i, icon: "coffee", color: "#92400E" },
  { match: /helado|ice.?cream|postre|dulce|cake|pastel/i, icon: "ice-cream", color: "#EC4899" },
  { match: /panader|bakery|pan|boller/i, icon: "bread-slice", color: "#D97706" },
  { match: /mercado|market|supermerc|fruter|carnicer/i, icon: "cart", color: "#10B981" },
  { match: /farmac|pharmac|salud|parafarmac/i, icon: "medical-bag", color: "#3B82F6" },
  { match: /bebida|vin|cerveza|bar|drinks/i, icon: "coffee", color: "#7C3AED" },
];

const TYPE_FALLBACK: Record<string, MarkerMeta> = {
  restaurant: { icon: "silverware-fork-knife", color: "#FF6B35" },
  market: { icon: "cart", color: "#10B981" },
  bakery: { icon: "bread-slice", color: "#D97706" },
  pharmacy: { icon: "medical-bag", color: "#3B82F6" },
  store: { icon: "storefront", color: "#8B5CF6" },
  other: { icon: "storefront", color: "#6B7280" },
};

/**
 * Icono + color de un negocio según su categoría (prioridad) o tipo.
 * `categories` es un string separado por comas (formato de la tabla businesses).
 */
export function businessMarkerMeta(type?: string, categories?: string): MarkerMeta {
  if (categories) {
    for (const rule of CATEGORY_RULES) {
      if (rule.match.test(categories)) {
        return { icon: rule.icon, color: rule.color };
      }
    }
  }
  return TYPE_FALLBACK[type ?? "restaurant"] ?? TYPE_FALLBACK.restaurant;
}

// ─── VEHÍCULOS DE REPARTIDOR ─────────────────────────────────────────────────

export interface VehicleMeta {
  icon: string; // MaterialCommunityIcons
  color: string;
  label: string;
}

const VEHICLE_MAP: Record<string, VehicleMeta> = {
  // Flujos reales: SignupScreen (bicycle/ebike/scooter/motorcycle/car),
  // BecomeDriverScreen + seeds (bike/motorcycle/car)
  bicycle: { icon: "bike", color: "#10B981", label: "Bicicleta" },
  ebike: { icon: "bike", color: "#10B981", label: "E-bike" },
  bike: { icon: "bike", color: "#10B981", label: "Bicicleta" },
  scooter: { icon: "moped", color: "#10B981", label: "Patinete" },
  moped: { icon: "moped", color: "#10B981", label: "Patinete" },
  motorcycle: { icon: "motorbike", color: "#10B981", label: "Moto" },
  motorbike: { icon: "motorbike", color: "#10B981", label: "Moto" },
  moto: { icon: "motorbike", color: "#10B981", label: "Moto" },
  car: { icon: "car", color: "#10B981", label: "Coche" },
};

/** Normaliza cualquier valor de vehicle_type de la BD a un icono de vehículo. */
export function vehicleMarkerMeta(vehicleType?: string | null): VehicleMeta {
  if (!vehicleType) return VEHICLE_MAP.motorcycle;
  return VEHICLE_MAP[vehicleType.toLowerCase().trim()] ?? VEHICLE_MAP.motorcycle;
}

// ─── CLIENTE / PEDIDO ────────────────────────────────────────────────────────

export const CUSTOMER_MARKER: MarkerMeta = { icon: "home", color: "#2563EB" };
export const ORDER_MARKER: MarkerMeta = { icon: "package-variant-closed", color: "#DC2626" };
export const DRIVER_NAVIGATING_MARKER: MarkerMeta = { icon: "navigation", color: "#DC2626" };
