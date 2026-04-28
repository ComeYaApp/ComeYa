import { Dimensions, Platform } from "react-native";

const MAX_CONTENT_WIDTH = 680;
const BREAKPOINT_DESKTOP = 900;

export function useWebLayout() {
  const windowWidth = Dimensions.get("window").width;
  const isWeb = Platform.OS === "web";
  const isDesktop = isWeb && windowWidth >= BREAKPOINT_DESKTOP;

  return {
    isWeb,
    isDesktop,
    windowWidth,
    // Estilos para el contenedor principal de cada pantalla
    containerStyle: isDesktop ? {
      flex: 1 as const,
      alignItems: "center" as const,
      backgroundColor: "#f5f5f5",
    } : { flex: 1 as const },
    // Estilos para el contenido centrado
    contentStyle: isDesktop ? {
      width: MAX_CONTENT_WIDTH,
      flex: 1 as const,
      backgroundColor: "#ffffff",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
    } : { flex: 1 as const },
    maxWidth: MAX_CONTENT_WIDTH,
  };
}
