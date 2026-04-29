import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { useResponsive } from "@/hooks/useResponsive";

interface Props {
  // Panel izquierdo (sidebar)
  sidebar: React.ReactNode;
  // Contenido principal
  children: React.ReactNode;
  // En móvil, el sidebar se muestra ENCIMA del contenido (como header extra)
  // o se oculta completamente si mobileSidebar no se pasa
  mobileSidebar?: React.ReactNode;
  sidebarWidth?: number;
  bg?: string;
  scrollable?: boolean; // si el contenido principal hace scroll
}

/**
 * Layout de dos columnas responsivo.
 * - Desktop/Tablet: sidebar izquierdo fijo + contenido derecho
 * - Móvil: sidebar oculto (o reemplazado por mobileSidebar encima), contenido a ancho completo
 */
export function TwoColumnLayout({
  sidebar,
  children,
  mobileSidebar,
  sidebarWidth,
  bg,
  scrollable = false,
}: Props) {
  const { isMobile, sidebarWidth: defaultSidebarWidth } = useResponsive();
  const sw = sidebarWidth ?? defaultSidebarWidth;

  if (isMobile) {
    return (
      <View style={[s.root, bg ? { backgroundColor: bg } : null]}>
        {mobileSidebar && (
          <View style={s.mobileSidebarWrap}>{mobileSidebar}</View>
        )}
        <View style={s.mobileContent}>{children}</View>
      </View>
    );
  }

  return (
    <View style={[s.root, bg ? { backgroundColor: bg } : null]}>
      <View style={[s.sidebar, { width: sw }]}>{sidebar}</View>
      <View style={s.content}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  root:              { flex: 1, flexDirection: "row" },
  sidebar:           { flexShrink: 0 },
  content:           { flex: 1 },
  mobileSidebarWrap: { width: "100%" as any },
  mobileContent:     { flex: 1 },
});
