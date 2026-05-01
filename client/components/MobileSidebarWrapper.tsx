import React, { useState } from "react";
import { View, Pressable, StyleSheet, Text, Modal, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useResponsive } from "@/hooks/useResponsive";
import { useTheme } from "@/hooks/useTheme";

const PRIMARY = "#DC2626";

interface Props {
  children: React.ReactNode;       // contenido del sidebar
  title?: string;                  // título del drawer móvil
  sidebarStyle?: object;           // estilos extra del sidebar en desktop
}

export function MobileSidebarWrapper({ children, title = "Filtros", sidebarStyle }: Props) {
  const { isMobile } = useResponsive();
  const { isDark } = useTheme();
  const [open, setOpen] = useState(false);

  const card   = isDark ? "#1e1e1e" : "#fff";
  const bg     = isDark ? "#111"    : "#f7f7f7";
  const text   = isDark ? "#fff"    : "#1a1a1a";
  const border = isDark ? "#333"    : "#e8e8e8";

  if (!isMobile) {
    return (
      <View style={[s.desktopSidebar, sidebarStyle]}>
        {children}
      </View>
    );
  }

  return (
    <>
      {/* Botón hamburguesa flotante */}
      <Pressable
        onPress={() => setOpen(true)}
        style={[s.hamburger, { backgroundColor: PRIMARY }]}
      >
        <Feather name="menu" size={20} color="#fff" />
      </Pressable>

      {/* Drawer modal */}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)} />
        <View style={[s.drawer, { backgroundColor: card, borderTopColor: border }]}>
          {/* Header del drawer */}
          <View style={[s.drawerHeader, { borderBottomColor: border }]}>
            <Text style={[s.drawerTitle, { color: text }]}>{title}</Text>
            <Pressable onPress={() => setOpen(false)} style={[s.closeBtn, { backgroundColor: bg }]}>
              <Feather name="x" size={18} color={text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={s.drawerContent} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  desktopSidebar: { borderRightWidth: 1, height: "100vh" as any, overflowY: "auto" as any, flexDirection: "column" as any, display: "flex" as any },
  hamburger: {
    position: "absolute" as any,
    bottom: 24,
    right: 24,
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  drawer: {
    maxHeight: "80%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  drawerTitle: { fontSize: 16, fontWeight: "700" },
  closeBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  drawerContent: { padding: 20, paddingBottom: 40 },
});
