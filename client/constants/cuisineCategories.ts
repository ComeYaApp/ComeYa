import { ComeyaIconName } from "@/components/icons/comeya/ComeyaIcon";

/**
 * Categorías de cocina del Home ("¿Qué quieres pedir hoy?").
 *
 * El cliente pidió EXACTAMENTE estas seis, en este orden, sin repetidos y sin
 * extras. Antes la lista se deducía de la primera categoría de cada negocio y
 * el desduplicado era por clave cruda, no por categoría canónica: `tacos` y
 * `mexicana` daban dos chips "Mexicana", y aparecían chips sueltos de
 * "Carnicería", "Ramen", "Asiática" o "Mariscos". Ahora la lista es fija y lo
 * único que se deduce de la BD es qué negocios entran en cada tarjeta.
 *
 * Este módulo es la ÚNICA fuente: lo usan el Home nativo y el web, así que no
 * pueden volver a divergir.
 */
export interface CuisineCategory {
  /** Identificador estable; es el que se guarda en el estado del filtro. */
  id: string;
  /** Etiqueta visible (con tildes correctas). */
  label: string;
  icon: ComeyaIconName;
  /**
   * Categorías de la BD que pertenecen a esta tarjeta. Se comparan en
   * minúsculas y sin tildes, así que aquí van siempre normalizadas.
   */
  match: string[];
}

/**
 * Orden oficial pedido por el cliente:
 * 1 Española (paella) · 2 Oriental (sushi) · 3 Mexicana (taco) · 4 Pollo ·
 * 5 Hamburguesas · 6 Pizza.
 *
 * Cada tarjeta agrupa sus sinónimos reales de la base de datos, de forma que
 * un negocio con categoría `tacos` o `antojitos` sale al tocar "Mexicana", y
 * la carnicería (`carniceria`) sale al tocar "Pollo" (que es como estaba
 * clasificada antes), pero sin generar un chip propio.
 */
export const CUISINE_CATEGORIES: CuisineCategory[] = [
  {
    id: "paella",
    label: "Española",
    icon: "paella",
    match: ["paella", "mariscos", "espanola", "arroceria", "arroz", "tapas"],
  },
  {
    id: "sushi",
    label: "Oriental",
    icon: "sushi",
    match: [
      "sushi",
      "ramen",
      "asiatica",
      "japonesa",
      "china",
      "tailandesa",
      "wok",
    ],
  },
  {
    id: "tacos",
    label: "Mexicana",
    icon: "taco",
    match: ["tacos", "mexicana", "antojitos", "tex-mex", "texmex"],
  },
  {
    id: "pollo",
    label: "Pollo",
    icon: "pollo",
    match: ["pollo", "carniceria", "alitas", "asador", "parrilla"],
  },
  {
    id: "hamburguesas",
    label: "Hamburguesas",
    icon: "hamburguesa",
    match: ["burger", "burgers", "hamburguesas", "americana"],
  },
  {
    id: "pizza",
    label: "Pizza",
    icon: "pizza",
    match: ["pizza", "pizzeria", "italiana", "pastas"],
  },
];

// Reemplazo explícito de tildes en vez de String.normalize: es determinista y
// no depende del motor de JS del dispositivo.
const ACCENTS: Record<string, string> = {
  á: "a",
  à: "a",
  ä: "a",
  â: "a",
  é: "e",
  è: "e",
  ë: "e",
  ê: "e",
  í: "i",
  ì: "i",
  ï: "i",
  î: "i",
  ó: "o",
  ò: "o",
  ö: "o",
  ô: "o",
  ú: "u",
  ù: "u",
  ü: "u",
  û: "u",
  ñ: "n",
  ç: "c",
};

/** "Mexicana " → "mexicana"; "Española" → "espanola". */
export function normalizeCategoryKey(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[áàäâéèëêíìïîóòöôúùüûñç]/g, (c) => ACCENTS[c] ?? c);
}

/** ¿Este negocio pertenece a la categoría de cocina `categoryId`? */
export function matchesCuisine(
  businessCategories: string[] | null | undefined,
  categoryId: string | null | undefined,
): boolean {
  if (!categoryId) return false;
  const cuisine = CUISINE_CATEGORIES.find((c) => c.id === categoryId);
  if (!cuisine) return false;
  return (businessCategories || []).some((raw) =>
    cuisine.match.includes(normalizeCategoryKey(raw)),
  );
}
