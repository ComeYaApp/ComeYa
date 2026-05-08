import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Pressable, Text, ActivityIndicator } from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { ComeYaColors } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { MobileSidebarWrapper } from "@/components/MobileSidebarWrapper";
import { ConfirmModal } from "@/components/ConfirmModal";
import { WebLayout } from "@/components/WebLayout";

const PRIMARY = "#DC2626";

interface Address {
  id: string;
  label: string;
  street: string;
  city: string;
  state: string;
  zipCode?: string;
  isDefault: boolean;
}

function resolveProfileImageUrl(img: string): string {
  if (img.startsWith("data:image/")) return img;
  const base = getApiUrl().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(img)) return img;
  return `${base}${img.startsWith("/") ? "" : "/"}${img}`;
}

export default function SavedAddressesScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();

  const bg      = isDark ? "#111"    : "#f7f7f7";
  const card    = isDark ? "#1e1e1e" : "#fff";
  const border  = isDark ? "#333"    : "#e8e8e8";
  const text    = isDark ? "#fff"    : "#1a1a1a";
  const sub     = isDark ? "#aaa"    : "#666";
  const cardBg  = isDark ? "#2a2a2a" : "#f9fafb";

  const [addresses, setAddresses]           = useState<Address[]>([]);
  const [loading, setLoading]               = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState<string | null>(null);
  const [profileImage, setProfileImage]     = useState<string | null>(null);

  useEffect(() => {
    if (user?.profileImage) setProfileImage(resolveProfileImageUrl(user.profileImage));
  }, [user?.profileImage]);

  useFocusEffect(React.useCallback(() => { loadAddresses(); }, []));

  const loadAddresses = async () => {
    try {
      const res = await apiRequest("GET", `/api/users/${user?.id}/addresses`);
      const data = await res.json();
      setAddresses(data.addresses || []);
    } catch { } finally { setLoading(false); }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await apiRequest("PUT", `/api/users/${user?.id}/addresses/${id}/default`);
      await loadAddresses();
      showToast("Dirección predeterminada actualizada", "success");
    } catch { showToast("Error al actualizar dirección", "error"); }
  };

  const confirmDelete = async () => {
    if (!addressToDelete) return;
    try {
      await apiRequest("DELETE", `/api/users/${user?.id}/addresses/${addressToDelete}`);
      await loadAddresses();
      showToast("Dirección eliminada", "success");
    } catch { showToast("Error al eliminar dirección", "error"); }
    finally { setShowDeleteModal(false); setAddressToDelete(null); }
  };

  const getRoleLabel = () => {
    switch (user?.role) {
      case "customer": return "Cliente";
      case "business_owner": return "Negocio";
      case "delivery_driver": return "Repartidor";
      default: return "Admin";
    }
  };

  return (
    <WebLayout>
    <View style={[s.root, { backgroundColor: bg }]}>
      {/* Sidebar — igual al de ProfileScreen */}
      <MobileSidebarWrapper title="Mis Direcciones" sidebarStyle={[s.sidebar, { backgroundColor: card, borderRightColor: border }]}>
        <View style={[s.sideHeader, { borderBottomColor: border }]}>
          <Pressable style={s.avatarWrap} onPress={() => navigation.navigate("EditProfile")}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={s.avatar} contentFit="cover" />
            ) : (
              <View style={[s.avatar, { backgroundColor: PRIMARY + "20", justifyContent: "center", alignItems: "center" }]}>
                <Feather name="user" size={40} color={PRIMARY} />
              </View>
            )}
          </Pressable>
          <Text style={[s.userName, { color: text }]}>{user?.name || "Usuario"}</Text>
          <Text style={[s.userPhone, { color: sub }]}>{user?.phone || ""}</Text>
          <View style={[s.roleBadge, { backgroundColor: PRIMARY + "15" }]}>
            <Text style={[s.roleBadgeText, { color: PRIMARY }]}>{getRoleLabel()}</Text>
          </View>
        </View>
        <View style={s.sideNav}>
          <Pressable onPress={() => navigation.navigate("Profile")} style={s.navItem}>
            <Feather name="user" size={18} color={sub} />
            <Text style={[s.navItemText, { color: text }]}>Cuenta</Text>
          </Pressable>
          <Pressable style={[s.navItem, s.navItemActive]}>
            <Feather name="map-pin" size={18} color={PRIMARY} />
            <Text style={[s.navItemText, { color: PRIMARY }]}>Mis direcciones</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate("PaymentWalletSetup")} style={s.navItem}>
            <Feather name="credit-card" size={18} color={sub} />
            <Text style={[s.navItemText, { color: text }]}>Métodos de pago</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate("Support")} style={s.navItem}>
            <Feather name="help-circle" size={18} color={sub} />
            <Text style={[s.navItemText, { color: text }]}>Soporte</Text>
          </Pressable>
        </View>
        <View style={[s.sideFooter, { borderTopColor: border }]}>
          <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
            <Feather name="arrow-left" size={16} color={sub} />
            <Text style={[s.backBtnText, { color: text }]}>Volver</Text>
          </Pressable>
        </View>
      </MobileSidebarWrapper>

      {/* Main */}
      <ScrollView style={s.main} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.titleRow}>
          <Text style={[s.pageTitle, { color: text }]}>Mis direcciones</Text>
          <Pressable
            onPress={() => navigation.navigate("AddAddress")}
            style={[s.addBtn, { backgroundColor: PRIMARY }]}
          >
            <Feather name="plus" size={16} color="#fff" />
            <Text style={s.addBtnText}>Añadir</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} />
        ) : addresses.length === 0 ? (
          <View style={[s.emptyCard, { backgroundColor: card, borderColor: border }]}>
            <Feather name="map-pin" size={48} color={sub} />
            <Text style={[s.emptyTitle, { color: text }]}>Sin direcciones guardadas</Text>
            <Text style={[s.emptyHint, { color: sub }]}>Agrega una dirección para hacer tus pedidos más rápido</Text>
            <Pressable onPress={() => navigation.navigate("AddAddress")} style={[s.addBtn, { backgroundColor: PRIMARY, marginTop: 20 }]}>
              <Feather name="plus" size={16} color="#fff" />
              <Text style={s.addBtnText}>Agregar dirección</Text>
            </Pressable>
          </View>
        ) : (
          addresses.map(addr => (
            <View key={addr.id} style={[s.addrCard, { backgroundColor: card, borderColor: addr.isDefault ? PRIMARY : border }]}>
              <View style={s.addrHeader}>
                <View style={[s.addrIcon, { backgroundColor: PRIMARY + "15" }]}>
                  <Feather name={addr.label === "Casa" ? "home" : addr.label === "Trabajo" ? "briefcase" : "map-pin"} size={20} color={PRIMARY} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[s.addrLabel, { color: text }]}>{addr.label}</Text>
                  <Text style={[s.addrStreet, { color: sub }]}>{addr.street}</Text>
                  <Text style={[s.addrCity, { color: sub }]}>{addr.city}, {addr.state}{addr.zipCode ? ` ${addr.zipCode}` : ""}</Text>
                </View>
                {addr.isDefault && (
                  <View style={s.defaultBadge}>
                    <Feather name="check-circle" size={13} color="#059669" />
                    <Text style={s.defaultBadgeText}>Predeterminada</Text>
                  </View>
                )}
              </View>
              <View style={[s.addrActions, { borderTopColor: border }]}>
                <Pressable onPress={() => navigation.navigate("AddAddress", { address: addr })} style={s.actionBtn}>
                  <Feather name="edit-2" size={14} color={PRIMARY} />
                  <Text style={[s.actionBtnText, { color: PRIMARY }]}>Editar</Text>
                </Pressable>
                {!addr.isDefault && (
                  <Pressable onPress={() => handleSetDefault(addr.id)} style={s.actionBtn}>
                    <Feather name="check" size={14} color={PRIMARY} />
                    <Text style={[s.actionBtnText, { color: PRIMARY }]}>Predeterminar</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => { setAddressToDelete(addr.id); setShowDeleteModal(true); }} style={[s.actionBtn, { backgroundColor: "#FEE2E2", borderColor: "#FCA5A5" }]}>
                  <Feather name="trash-2" size={14} color="#DC2626" />
                  <Text style={[s.actionBtnText, { color: "#DC2626" }]}>Eliminar</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <ConfirmModal
        visible={showDeleteModal}
        title="Eliminar dirección"
        message="¿Estás seguro de eliminar esta dirección?"
        onConfirm={confirmDelete}
        onCancel={() => { setShowDeleteModal(false); setAddressToDelete(null); }}
        confirmText="Eliminar"
      />
    </View>
    </View>
    </WebLayout>
  );
}

const s = StyleSheet.create({
  root:           { flex: 1, flexDirection: "row", overflow: "hidden" as any },
  sidebar:        { width: 280, borderRightWidth: 1, flexDirection: "column" as any },
  sideHeader:     { padding: 24, alignItems: "center", borderBottomWidth: 1 },
  avatarWrap:     { position: "relative", marginBottom: 12 },
  avatar:         { width: 80, height: 80, borderRadius: 40 },
  userName:       { fontSize: 17, fontWeight: "700", marginBottom: 4, textAlign: "center" },
  userPhone:      { fontSize: 13, marginBottom: 10, textAlign: "center" },
  roleBadge:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  roleBadgeText:  { fontSize: 11, fontWeight: "700" },
  sideNav:        { flex: 1, paddingVertical: 16 },
  navItem:        { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 20 },
  navItemActive:  { backgroundColor: "#DC262610", borderRightWidth: 3, borderRightColor: "#DC2626" },
  navItemText:    { fontSize: 14, fontWeight: "600" },
  sideFooter:     { borderTopWidth: 1, padding: 16 },
  backBtn:        { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  backBtnText:    { fontSize: 14, fontWeight: "600" },
  main:           { flex: 1, height: "100vh" as any },
  content:        { padding: 32, maxWidth: 720, paddingBottom: 80 },
  titleRow:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
  pageTitle:      { fontSize: 22, fontWeight: "800" },
  addBtn:         { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  addBtnText:     { color: "#fff", fontSize: 14, fontWeight: "700" },
  emptyCard:      { borderRadius: 16, borderWidth: 1, padding: 48, alignItems: "center" },
  emptyTitle:     { fontSize: 18, fontWeight: "700", marginTop: 16, marginBottom: 8 },
  emptyHint:      { fontSize: 14, textAlign: "center", lineHeight: 20 },
  addrCard:       { borderRadius: 16, borderWidth: 1.5, marginBottom: 16, overflow: "hidden" },
  addrHeader:     { flexDirection: "row", alignItems: "flex-start", padding: 20 },
  addrIcon:       { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  addrLabel:      { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  addrStreet:     { fontSize: 14, marginBottom: 2 },
  addrCity:       { fontSize: 12 },
  defaultBadge:   { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#ECFDF5", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  defaultBadgeText: { fontSize: 11, fontWeight: "700", color: "#059669" },
  addrActions:    { flexDirection: "row", gap: 8, padding: 12, borderTopWidth: 1, flexWrap: "wrap" },
  actionBtn:      { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: "#e8e8e8", backgroundColor: "transparent" },
  actionBtnText:  { fontSize: 13, fontWeight: "600" },
});
