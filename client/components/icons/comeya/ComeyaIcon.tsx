import React from "react";
import Svg, { Circle, Ellipse, G, Path, Rect } from "react-native-svg";

/**
 * Iconos de marca ComeYa, recreados en SVG (line-art, cuadrícula 24x24,
 * trazos redondeados) a partir del pack del diseñador en /nuevosdiseños.
 *
 * Uso: <ComeyaIcon name="taco" size={28} color="#FFFFFF" />
 * El color va por `stroke`; los rellenos puntuales (puntos decorativos)
 * usan el mismo color vía `fill`.
 */

// Iconos densos que necesitan trazo más fino para no empastarse
const THIN_ICONS = new Set<string>(["paella"]);

type IconRenderer = (color: string) => React.ReactNode;

const ICON_RENDERERS: Record<string, IconRenderer> = {
  taco: (c) => (
    <>
      <Path d="M2.9 16.9a9.1 9.1 0 0 1 18.2 0Z" />
      <Path d="M6.4 16.9a5.6 5.6 0 0 1 11.2 0" />
      <Path d="M6.7 9.8a1.85 1.85 0 0 1 3.6-.75a1.9 1.9 0 0 1 3.75-.4a1.85 1.85 0 0 1 3.5.5" />
      <Circle cx="10.4" cy="13.7" r="0.4" fill={c} stroke="none" />
      <Circle cx="13.6" cy="13.7" r="0.4" fill={c} stroke="none" />
    </>
  ),
  hamburguesa: (c) => (
    <>
      <Path d="M4.6 10.3c0-3.3 3.3-5.5 7.4-5.5s7.4 2.2 7.4 5.5c0 .9-.6 1.4-1.5 1.4H6.1c-.9 0-1.5-.5-1.5-1.4Z" />
      <Circle cx="9.6" cy="7.6" r="0.55" fill={c} stroke="none" />
      <Circle cx="13.9" cy="7.2" r="0.55" fill={c} stroke="none" />
      <Circle cx="11.9" cy="9.3" r="0.55" fill={c} stroke="none" />
      <Path d="M4.7 14.1c1.1-1 2.2-1 3.3 0s2.2 1 3.3 0s2.2-1 3.3 0s2.2 1 3.3 0" />
      <Path d="M5.1 17.4h13.8" />
      <Path d="M5.2 20.4h13.6c0-1.7-1.3-3-3.1-3H8.3c-1.8 0-3.1 1.3-3.1 3Z" />
    </>
  ),
  pizza: (c) => (
    <>
      <Path d="M4.6 8.1a7.4 3.2 0 0 1 14.8 0Z" />
      <Path d="M5.4 9.4c.5 1.3 3.4 6.9 5.7 11.2c.4.8 1.4.8 1.8 0c2.3-4.3 5.2-9.9 5.7-11.2" />
      <Circle cx="9.4" cy="10.4" r="1.1" />
      <Circle cx="14.2" cy="10.1" r="1" />
      <Circle cx="12" cy="14.2" r="0.95" />
    </>
  ),
  sushi: (c) => (
    <>
      <Circle cx="7.3" cy="14.4" r="4.7" />
      <Circle cx="7.3" cy="14.4" r="1.8" />
      <Circle cx="7.3" cy="14.4" r="0.5" fill={c} stroke="none" />
      <G transform="rotate(-14 16.4 12.6)">
        <Rect x="12.4" y="11.2" width="8" height="4.2" rx="2.1" />
        <Rect x="13.2" y="8.5" width="6.4" height="3.2" rx="1.6" />
      </G>
    </>
  ),
  pollo: (c) => (
    <>
      <Path d="M14.6 3.9a5.7 5.7 0 0 1 5.5 5.9c-.2 3.2-2.5 5.1-5 5.6c-1.9.4-3.1 1.2-4 2.6c-.4.6-1.2.7-1.7.2l-3.1-3.1c-.5-.5-.5-1.3.1-1.7c1.4-1 2.2-2.2 2.5-4.1c.5-3 2.7-5.3 5.7-5.4Z" />
      <Path d="M7.5 16.5l-2.9 2.9" />
      <Circle cx="3.7" cy="18.6" r="1.5" />
      <Circle cx="5.4" cy="20.3" r="1.5" />
    </>
  ),
  paella: (c) => (
    <>
      <Ellipse cx="12" cy="10.8" rx="8.9" ry="4.9" />
      <Path d="M3.1 10.8c0 3.8 4 6.3 8.9 6.3s8.9-2.5 8.9-6.3" />
      <Path d="M3.1 10c-1.5.3-2.2 1-2.2 1.9c0 1 1 1.8 2.5 2" />
      <Path d="M20.9 10c1.5.3 2.2 1 2.2 1.9c0 1-1 1.8-2.5 2" />
      <Path d="M8.9 9a1.9 1.9 0 1 0-1.9 1.9" />
      <Path d="M8.9 9l1.3-.9" />
      <Path d="M8.9 9l1.6.4" />
      <Circle cx="8.9" cy="10.9" r="0.45" fill={c} stroke="none" />
      <Path d="M14.3 9.4a2.2 2.2 0 0 1 2.2 2.2h-2.2Z" />
      <Circle cx="13" cy="13" r="0.45" fill={c} stroke="none" />
    </>
  ),
  ensalada: () => (
    <>
      <Path d="M4.5 12.8h15a7.5 7.5 0 0 1-15 0Z" />
      <Circle cx="8.3" cy="10.2" r="2.1" />
      <Circle cx="12.1" cy="9.3" r="2.4" />
      <Circle cx="15.9" cy="10.2" r="2.1" />
    </>
  ),
  ramen: () => (
    <>
      <Path d="M4.2 11.6h15.6a7.8 7.8 0 0 1-15.6 0Z" />
      <Path d="M9.6 19.2h4.8" />
      <Path d="M14.2 3.2L10 10" />
      <Path d="M18 2.4l-3.2 7.4" />
      <Path d="M7.3 14.2c.9.8 1.9.8 2.8 0s1.9-.8 2.8 0s1.9.8 2.8 0" />
    </>
  ),
  postre: (c) => (
    <>
      <Path d="M5.2 19.3v-8.1c0-.7.5-1.2 1.2-1.2h11.2c.7 0 1.2.5 1.2 1.2v8.1Z" />
      <Path d="M5.2 12.2c1.13 1.5 2.27 1.5 3.4 0c1.13 1.5 2.27 1.5 3.4 0c1.13 1.5 2.27 1.5 3.4 0c1.13 1.5 2.27 1.5 3.4 0" />
      <Path d="M8.7 16.3h6.6" />
      <Circle cx="12" cy="8.6" r="1.1" fill={c} stroke="none" />
    </>
  ),
  mercado: () => (
    <>
      <Path d="M5.4 10.8V19h13.2v-8.2" />
      <Path d="M4.4 5.3h15.2l1.1 4.1c0 1.2-1 2.2-2.2 2.2s-2.2-1-2.2-2.2c0 1.2-1 2.2-2.2 2.2s-2.2-1-2.2-2.2c0 1.2-1 2.2-2.2 2.2s-2.2-1-2.2-2.2c0 1.2-1 2.2-2.2 2.2s-2.1-1-2.1-2.2Z" />
      <Path d="M9.4 19v-4.4h5.2V19" />
    </>
  ),
  inicio: () => (
    <>
      <Path d="M4.2 11.4 12 4.6l7.8 6.8" />
      <Path d="M6.3 9.9V18a1.9 1.9 0 0 0 1.9 1.9h7.6a1.9 1.9 0 0 0 1.9-1.9V9.9" />
      <Path d="M10.1 19.7v-3.9a1.9 1.9 0 0 1 3.8 0v3.9" />
    </>
  ),
  pedidos: () => (
    <>
      <Path d="M5.9 8.3h12.2l-.9 10.4a2.1 2.1 0 0 1-2.1 1.9H8.9a2.1 2.1 0 0 1-2.1-1.9Z" />
      <Path d="M9.1 8V6.9a2.9 2.9 0 0 1 5.8 0V8" />
    </>
  ),
  mapa: () => (
    <>
      <Path d="M12 20.7s-6.6-5.5-6.6-10.1A6.6 6.6 0 0 1 12 4a6.6 6.6 0 0 1 6.6 6.6c0 4.6-6.6 10.1-6.6 10.1Z" />
      <Circle cx="12" cy="10.4" r="2.4" />
    </>
  ),
  perfil: () => (
    <>
      <Circle cx="12" cy="8" r="3.6" />
      <Path d="M5.4 19.8a6.6 6.1 0 0 1 13.2 0" />
    </>
  ),
  rayo: () => <Path d="M13.4 2.9 5.7 13.5h4.9l-1.7 7.6 7.7-10.6h-4.9Z" />,
  dolar: () => (
    <>
      <Circle cx="12" cy="12" r="8.7" />
      <Path d="M12 6.9v10.2" />
      <Path d="M14.8 9.1c-.6-1-1.6-1.5-2.8-1.5c-1.7 0-3 .9-3 2.3c0 2.9 5.9 1.5 5.9 4.4c0 1.4-1.3 2.3-3 2.3c-1.3 0-2.4-.6-3-1.6" />
    </>
  ),
  estrella: () => (
    <Path d="M12 3.7l2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8Z" />
  ),
  estrellaRellena: (c) => (
    <Path
      d="M12 3.7l2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8Z"
      fill={c}
    />
  ),
  lupa: () => (
    <>
      <Circle cx="10.9" cy="10.9" r="6.5" />
      <Path d="M15.7 15.7 20.5 20.5" />
    </>
  ),
  corazon: () => (
    <Path d="M12 20.1S4.1 15.4 4.1 9.7C4.1 7 6.1 5.1 8.4 5.1c1.5 0 2.9.8 3.6 2c.7-1.2 2.1-2 3.6-2c2.3 0 4.3 1.9 4.3 4.6c0 5.7-7.9 10.4-7.9 10.4Z" />
  ),
  corazonRelleno: (c) => (
    <Path
      d="M12 20.1S4.1 15.4 4.1 9.7C4.1 7 6.1 5.1 8.4 5.1c1.5 0 2.9.8 3.6 2c.7-1.2 2.1-2 3.6-2c2.3 0 4.3 1.9 4.3 4.6c0 5.7-7.9 10.4-7.9 10.4Z"
      fill={c}
    />
  ),
  luna: () => (
    <Path d="M19.9 14.3A8.5 8.5 0 0 1 9.7 4.1a8.5 8.5 0 1 0 10.2 10.2Z" />
  ),
  sliders: () => (
    <>
      <Path d="M4.5 6.6h3.2" />
      <Path d="M11.5 6.6h8" />
      <Circle cx="9.6" cy="6.6" r="1.9" />
      <Path d="M4.5 12h8.6" />
      <Path d="M16.9 12h2.6" />
      <Circle cx="15" cy="12" r="1.9" />
      <Path d="M4.5 17.4h1.8" />
      <Path d="M10.1 17.4h9.4" />
      <Circle cx="8.2" cy="17.4" r="1.9" />
    </>
  ),
  reloj: () => (
    <>
      <Circle cx="12" cy="12" r="8.5" />
      <Path d="M12 7.5V12l3.2 2" />
    </>
  ),
  medalla: () => (
    <>
      <Circle cx="12" cy="9.3" r="5.3" />
      <Circle cx="12" cy="9.3" r="2.4" />
      <Path d="M9.3 13.7 7.5 20.2l4.5-2.5l4.5 2.5l-1.8-6.5" />
    </>
  ),
  regalo: () => (
    <>
      <Path d="M5 11.7h14v7.7a1.7 1.7 0 0 1-1.7 1.7H6.7A1.7 1.7 0 0 1 5 19.4Z" />
      <Path d="M4.1 8.4h15.8V11.7H4.1Z" />
      <Path d="M12 8.4v12.7" />
      <Path d="M12 8.2c-1.8-.2-4.3-.7-4.3-2.6c0-1.3 1.2-2.2 2.3-1.8c1.6.5 2 2.8 2 4.4c0-1.6.4-3.9 2-4.4c1.2-.4 2.3.5 2.3 1.8c0 1.9-2.5 2.4-4.3 2.6Z" />
    </>
  ),
};

export type ComeyaIconName = keyof typeof ICON_RENDERERS;

export const COMEYA_ICON_NAMES = Object.keys(ICON_RENDERERS) as ComeyaIconName[];

interface ComeyaIconProps {
  name: ComeyaIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  testID?: string;
}

export function ComeyaIcon({
  name,
  size = 24,
  color = "#FFFFFF",
  strokeWidth,
  testID,
}: ComeyaIconProps) {
  const renderer = ICON_RENDERERS[name];
  if (!renderer) return null;
  const width = strokeWidth ?? (THIN_ICONS.has(name) ? 1.5 : 1.8);
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      testID={testID}
    >
      {renderer(color)}
    </Svg>
  );
}

export default ComeyaIcon;
