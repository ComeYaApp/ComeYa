import React, { useState } from "react";
import { View, StyleSheet, Pressable, Text } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { confirm } from "@/hooks/useWebDialog";
import { useBusiness } from "@/contexts/BusinessContext";

const PRIMARY = "#DC2626";

const NAV_ITEMS = [
  { id: "BusinessDashboard", label: "Dashboard", icon: "bar-chart-2" },
  { id: "BusinessOrders", label: "Pedidos", icon: "package" },
  { id: "BusinessProducts", label: "Productos", icon: "grid" },
  { id: "BusinessReservations", label: "Reservas", icon: "calendar" },
  { id: "BusinessHours", label: "Horarios", icon: "clock" },
  { id: "BusinessStats", label: "Estadísticas", icon: "trending-up" },
];

interface Props {
  activeSection?: string;
}

export function BusinessSidebar({ activeSection }: Props) {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { isDark } = useTheme();
  const { logout } = useAuth();
  const { selectedBusiness, businesses, selectBusiness } = useBusiness();
  const [showPicker, setShowPicker] = useState(false);

  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";

  const dropdownBg = isDark ? "#2c2c2c" : "#ffffff";
  const dropdownBorder = isDark ? "#484848" : "#c0c0c0";

  const activeName = activeSection || route.name;

  return (
    <View
      style={[s.sidebar, { backgroundColor: card, borderRightColor: border }]}
    >
      {/* Logo + negocio */}
      <View style={s.header}>
        <Image
          source={require("../../assets/images/comeya-logo-final.png")}
          style={s.logo}
          contentFit="contain"
        />
        <Pressable
          onPress={() => setShowPicker((v) => !v)}
          style={[
            s.bizSelector,
            {
              borderColor: showPicker ? PRIMARY : border,
              backgroundColor: showPicker ? PRIMARY + "08" : "transparent",
            },
          ]}
        >
          <Feather
            name="briefcase"
            size={13}
            color={showPicker ? PRIMARY : sub}
          />
          <Text style={[s.bizName, { color: text }]} numberOfLines={1}>
            {selectedBusiness?.name || "Mi Negocio"}
          </Text>
          <Feather
            name={showPicker ? "chevron-up" : "chevron-down"}
            size={14}
            color={showPicker ? PRIMARY : sub}
          />
        </Pressable>
        <Text style={[s.role, { color: sub }]}>Panel de negocio</Text>
      </View>

      {/* Navegación */}
      <View style={s.nav}>
        {NAV_ITEMS.map((item) => {
          const isActive = activeName === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => navigation.navigate(item.id as any)}
              style={[
                s.navItem,
                isActive && {
                  backgroundColor: PRIMARY + "10",
                  borderRightWidth: 3,
                  borderRightColor: PRIMARY,
                },
              ]}
            >
              <Feather
                name={item.icon as any}
                size={18}
                color={isActive ? PRIMARY : sub}
              />
              <Text style={[s.navText, { color: isActive ? PRIMARY : text }]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Footer */}
      <View style={[s.footer, { borderTopColor: border }]}>
        <Pressable
          onPress={async () => {
            const ok = await confirm({
              title: "Cerrar sesión",
              message: "¿Estás seguro que deseas salir?",
              confirmLabel: "Salir",
              cancelLabel: "Cancelar",
              variant: "warning",
            });
            if (ok) logout();
          }}
          style={s.navItem}
        >
          <Feather name="log-out" size={18} color="#EF4444" />
          <Text style={[s.navText, { color: "#EF4444" }]}>Salir</Text>
        </Pressable>
      </View>

      {/* Overlay para cerrar */}
      {showPicker && (
        <Pressable style={s.overlay} onPress={() => setShowPicker(false)} />
      )}

      {/* Dropdown — fuera del header, relativo al sidebar */}
      {showPicker && (
        <View
          style={[
            s.picker,
            { backgroundColor: dropdownBg, borderColor: dropdownBorder },
          ]}
        >
          {businesses.length === 0 && (
            <Text style={[s.pickerEmpty, { color: sub }]}>
              Sin negocios registrados
            </Text>
          )}
          {businesses.map((biz: any) => (
            <Pressable
              key={biz.id}
              onPress={() => {
                selectBusiness(biz);
                setShowPicker(false);
              }}
              style={[
                s.pickerItem,
                selectedBusiness?.id === biz.id && {
                  backgroundColor: PRIMARY + "15",
                },
              ]}
            >
              <Feather
                name="briefcase"
                size={13}
                color={selectedBusiness?.id === biz.id ? PRIMARY : sub}
              />
              <Text
                style={[
                  s.pickerText,
                  { color: selectedBusiness?.id === biz.id ? PRIMARY : text },
                ]}
                numberOfLines={1}
              >
                {biz.name}
              </Text>
              {selectedBusiness?.id === biz.id && (
                <Feather name="check" size={13} color={PRIMARY} />
              )}
            </Pressable>
          ))}
          <View
            style={[s.pickerDivider, { backgroundColor: dropdownBorder }]}
          />
          <Pressable
            onPress={() => {
              setShowPicker(false);
              navigation.navigate("MyBusinesses" as any);
            }}
            style={s.pickerItem}
          >
            <Feather name="settings" size={13} color={sub} />
            <Text style={[s.pickerText, { color: text }]}>
              Gestionar negocios
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setShowPicker(false);
              navigation.navigate("MyBusinesses" as any, {
                openAddModal: true,
              });
            }}
            style={s.pickerItem}
          >
            <Feather name="plus-circle" size={13} color={PRIMARY} />
            <Text style={[s.pickerText, { color: PRIMARY }]}>
              Añadir negocio
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  sidebar: {
    width: 240,
    borderRightWidth: 1,
    flexDirection: "column" as any,
    position: "relative" as any,
  },
  header: { padding: 24, paddingBottom: 16 },
  logo: { width: 100, height: 32, marginBottom: 12 },
  bizSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  bizName: { fontSize: 14, fontWeight: "700", flex: 1 },
  role: { fontSize: 12, paddingHorizontal: 2 },
  nav: { flex: 1 },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  navText: { fontSize: 14, fontWeight: "600" },
  footer: { borderTopWidth: 1 },
  overlay: {
    position: "absolute" as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 998,
  },
  picker: {
    position: "absolute" as any,
    top: 88,
    left: 12,
    right: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    zIndex: 999,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 30,
    ...({ boxShadow: "0 8px 32px rgba(0,0,0,0.28)" } as any),
  },
  pickerEmpty: {
    fontSize: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontStyle: "italic",
  },
  pickerDivider: { height: 1, marginVertical: 4, marginHorizontal: 10 },
  pickerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  pickerText: { flex: 1, fontSize: 13, fontWeight: "600" },
});
