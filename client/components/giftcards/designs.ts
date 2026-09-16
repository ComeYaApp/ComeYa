// Catálogo de diseños de tarjetas regalo ComeYa.
// Cada clave se guarda en gift_cards.design al comprar y se puede volver a
// pintar en "Mis Tarjetas" con el mismo arte animado.
export type GiftCardDesignKey =
  | "fiesta"
  | "gold"
  | "birthday"
  | "amor"
  | "soria"
  | "gourmet";

export interface GiftCardDesignDef {
  key: GiftCardDesignKey;
  name: string;
  emoji: string;
  /** Gradiente de fondo: [inicio, medio, fin] */
  colors: [string, string, string];
  /** Exclusivo de la zona premium */
  premium?: boolean;
  description: string;
}

export const GIFT_CARD_DESIGNS: GiftCardDesignDef[] = [
  {
    key: "gold",
    name: "Premium Gold",
    emoji: "👑",
    colors: ["#3D2E00", "#8A6A0F", "#C9A227"],
    premium: true,
    description: "Exclusivo Premium: marco dorado con brillo que recorre la tarjeta",
  },
  {
    key: "fiesta",
    name: "Celebración",
    emoji: "🎉",
    colors: ["#6D28D9", "#C026D3", "#EC4899"],
    description: "Confeti en movimiento para los momentos que se celebran",
  },
  {
    key: "birthday",
    name: "Cumpleaños",
    emoji: "🎂",
    colors: ["#0E7490", "#0891B2", "#38BDF8"],
    description: "Globos y confeti para el día más señalado",
  },
  {
    key: "amor",
    name: "Te Quiero",
    emoji: "❤️",
    colors: ["#BE123C", "#E11D48", "#FB7185"],
    description: "Corazones que laten para regalar cariño",
  },
  {
    key: "soria",
    name: "Soria",
    emoji: "🏰",
    colors: ["#7F1D1D", "#B91C1C", "#F87171"],
    description: "Orgullo local: almenas y torre en el rojo ComeYa",
  },
  {
    key: "gourmet",
    name: "Gourmet",
    emoji: "🍕",
    colors: ["#9A3412", "#EA580C", "#FBBF24"],
    description: "Para los que viven para la buena mesa",
  },
];

export function isGiftCardDesignKey(value: string): value is GiftCardDesignKey {
  return GIFT_CARD_DESIGNS.some((d) => d.key === value);
}
