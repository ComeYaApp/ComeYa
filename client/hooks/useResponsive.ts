import { useWindowDimensions } from "react-native";

export const BREAKPOINTS = {
  mobile:  768,
  tablet:  1024,
  desktop: 1280,
};

export function useResponsive() {
  const { width } = useWindowDimensions();

  const isMobile  = width < BREAKPOINTS.mobile;
  const isTablet  = width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet;
  const isDesktop = width >= BREAKPOINTS.tablet;

  return {
    width,
    isMobile,
    isTablet,
    isDesktop,
    // Sidebar: oculto en móvil, ancho reducido en tablet
    sidebarWidth: isMobile ? 0 : isTablet ? 200 : 280,
    showSidebar: !isMobile,
    // Padding horizontal según pantalla
    px: isMobile ? 16 : isTablet ? 20 : 28,
    // Columnas para grids
    gridCols: isMobile ? 1 : isTablet ? 2 : 3,
    // Tamaño de fuente escalado
    titleSize: isMobile ? 18 : 22,
    subtitleSize: isMobile ? 13 : 15,
  };
}
