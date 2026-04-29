import { Dimensions, Platform, useWindowDimensions } from "react-native";

const MAX_CONTENT_WIDTH = 680;
const BREAKPOINT_DESKTOP = 900;
const BREAKPOINT_MOBILE  = 768;

export function useWebLayout() {
  const { width: windowWidth } = useWindowDimensions();
  const isWeb     = Platform.OS === "web";
  const isDesktop = isWeb && windowWidth >= BREAKPOINT_DESKTOP;
  const isMobile  = isWeb && windowWidth < BREAKPOINT_MOBILE;

  return {
    isWeb,
    isDesktop,
    isMobile,
    windowWidth,
    containerStyle: isDesktop ? {
      flex: 1 as const,
      alignItems: "center" as const,
      backgroundColor: "#f5f5f5",
    } : { flex: 1 as const },
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
