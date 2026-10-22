/**
 * Alturas compartidas de la barra inferior web. Mantenerlas en un único sitio
 * evita que el chat flotante vuelva a solaparse con la tab bar.
 */
export const WEB_TAB_BAR_MOBILE_HEIGHT = 56;
export const WEB_TAB_BAR_DESKTOP_HEIGHT = 64;
export const WEB_TAB_BAR_MIN_INSET = 8;
export const WEB_CHAT_FAB_GAP = 16;

export function getWebTabBarHeight(isMobile: boolean, bottomInset = 0): number {
  const base = isMobile
    ? WEB_TAB_BAR_MOBILE_HEIGHT
    : WEB_TAB_BAR_DESKTOP_HEIGHT;
  return base + Math.max(bottomInset, WEB_TAB_BAR_MIN_INSET);
}
