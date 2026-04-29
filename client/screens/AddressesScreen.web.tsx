import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Text, TextInput, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { ComeYaColors, Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useResponsive } from "@/hooks/useResponsive";
import { MobileSidebarWrapper } from "@/components/MobileSidebarWrapper";

interface Address {
  id: string; label: string; street: string; city: string;
  state: string; zipCode?: string; isDefault: boolean;
}

export default function AddressesScreen() {
  const navigation = useNavigation<any>();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { isMobile } = useResponsive();

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const inputBg = isDark ? "#2a2a2a" : "#f5f5f5";

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ label: "", street: "", city: "", state: "", zipCode: "" });

  const { data, isLoading } = useQuery<{ addresses: Address[] }>({
    queryKey: ["/api/users", user?.id, "addresses"],
    enabled: !!user?.id,
  });
  const addresses = data?.addresses || [];

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/addresses", { ...form, userId: user?.id, isDefault: addresses.length === 0 });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "addresses"] });
      setShowForm(false);
      setForm({ label: "", street: "", city: "", state: "", zipCode: "" });
      showToast("Dirección agregada", "success");
    },
    onError: () => showToast("No se pudo agregar la dirección", "error"),
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/addresses/${id}/default`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "addresses"] });
      showToast("Dirección predeterminada actualizada", "success");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/addresses/${id}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "addresses"] });
      showToast("Dirección eliminada", "success");
    },
  });

  const handleAdd = () => {
    if (!form.label.trim() || !form.street.trim() || !form.city.trim() || !form.state.trim()) {
      showToast("Completa todos los campos obligatorios", "warning"); return;
    }
    createMutation.mutate();
  };

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <MobileSidebarWrapper title="Direcciones" sidebarStyle={[s.sidebar, { backgroundColor: card, borderRightColor: border }]}>
        <View style={[s.iconCircle, { backgroundColor: ComeYaColors.primary + "15" }]}>
          <Feather name="map-pin" size={28} color={ComeYaColors.primary} />
        </View>
        <Text style={[s.sideTitle, { color: text }]}>Mis Direcciones</Text>
        <Text style={[s.sideSub, { color: sub }]}>{addresses.length} dirección{addresses.length !== 1 ? "es" : ""} guardada{addresses.length !== 1 ? "s" : ""}</Text>
        <Pressable
          onPress={() => setShowForm(!showForm)}
          style={[s.addBtn, { backgroundColor: ComeYaColors.primary }]}
        >
          <Feather name={showForm ? "x" : "plus"} size={18} color="#fff" />
          <Text style={s.addBtnText}>{showForm ? "Cancelar" : "Nueva dirección"}</Text>
        </Pressable>
        <Pressable onPress={() => navigation.goBack()} style={[s.backBtn, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="arrow-left" size={16} color={text} />
          <Text style={[s.backBtnText, { color: text }]}>Volver</Text>
        </Pressable>
      </MobileSidebarWrapper>

      {/* Main */}
      <ScrollView style={s.main} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Formulario nueva dirección */}
        {showForm && (
          <View style={[s.formCard, { backgroundColor: card, borderColor: ComeYaColors.primary + "40" }]}>
            <Text style={[s.formTitle, { color: text }]}>Nueva dirección</Text>
            {[
              { key: "label", label: "Etiqueta *", placeholder: "Casa, Oficina..." },
              { key: "street", label: "Calle y número *", placeholder: "Calle Mayor 12" },
              { key: "city", label: "Ciudad *", placeholder: "Soria" },
              { key: "state", label: "Provincia *", placeholder: "Castilla y León" },
              { key: "zipCode", label: "Código postal", placeholder: "42001" },
            ].map(f => (
              <View key={f.key} style={s.field}>
                <Text style={[s.fieldLabel, { color: sub }]}>{f.label}</Text>
                <TextInput
                  style={[s.input, { backgroundColor: inputBg, color: text, borderColor: border }]}
                  value={(form as any)[f.key]}
                  onChangeText={v => setForm(prev => ({ ...prev, [f.key]: v }))}
                  placeholder={f.placeholder}
                  placeholderTextColor={sub}
                />
              </View>
            ))}
            <Pressable
              onPress={handleAdd}
              disabled={createMutation.isPending}
              style={[s.saveBtn, { backgroundColor: ComeYaColors.primary, opacity: createMutation.isPending ? 0.6 : 1 }]}
            >
              {createMutation.isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.saveBtnText}>Guardar dirección</Text>
              }
            </Pressable>
          </View>
        )}

        {/* Lista de direcciones */}
        {isLoading ? (
          <View style={s.loading}><ActivityIndicator color={ComeYaColors.primary} size="large" /></View>
        ) : addresses.length === 0 ? (
          <View style={s.empty}>
            <View style={[s.emptyIcon, { backgroundColor: ComeYaColors.primary + "10" }]}>
              <Feather name="map-pin" size={40} color={ComeYaColors.primary} />
            </View>
            <Text style={[s.emptyTitle, { color: text }]}>Sin direcciones guardadas</Text>
            <Text style={[s.emptySub, { color: sub }]}>Agrega una dirección para recibir tus pedidos más rápido</Text>
          </View>
        ) : (
          addresses.map(addr => (
            <View key={addr.id} style={[s.addrCard, { backgroundColor: card, borderColor: addr.isDefault ? ComeYaColors.primary : border, borderWidth: addr.isDefault ? 2 : 1 }]}>
              <View style={s.addrHeader}>
                <View style={[s.labelBadge, { backgroundColor: ComeYaColors.primary + "15" }]}>
                  <Feather name="map-pin" size={13} color={ComeYaColors.primary} />
                  <Text style={[s.labelText, { color: ComeYaColors.primary }]}>{addr.label}</Text>
                </View>
                {addr.isDefault && (
                  <View style={[s.defaultBadge, { backgroundColor: ComeYaColors.success + "15" }]}>
                    <Text style={[s.defaultText, { color: ComeYaColors.success }]}>Predeterminada</Text>
                  </View>
                )}
              </View>
              <Text style={[s.addrStreet, { color: text }]}>{addr.street}</Text>
              <Text style={[s.addrCity, { color: sub }]}>{addr.city}, {addr.state}{addr.zipCode ? ` · ${addr.zipCode}` : ""}</Text>
              <View style={s.addrActions}>
                {!addr.isDefault && (
                  <Pressable onPress={() => setDefaultMutation.mutate(addr.id)} style={[s.actionBtn, { borderColor: ComeYaColors.primary + "40" }]}>
                    <Feather name="check-circle" size={14} color={ComeYaColors.primary} />
                    <Text style={[s.actionText, { color: ComeYaColors.primary }]}>Predeterminada</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => deleteMutation.mutate(addr.id)} style={[s.actionBtn, { borderColor: ComeYaColors.error + "40" }]}>
                  <Feather name="trash-2" size={14} color={ComeYaColors.error} />
                  <Text style={[s.actionText, { color: ComeYaColors.error }]}>Eliminar</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "row" },
  sidebar: { width: 260, minWidth: 260, maxWidth: 260, padding: 28, borderRightWidth: 1, paddingTop: 48, alignItems: "center" },
  iconCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: "center", alignItems: "center", marginBottom: 16 },
  sideTitle: { fontSize: 20, fontWeight: "800", marginBottom: 4, textAlign: "center" },
  sideSub: { fontSize: 13, marginBottom: 24, textAlign: "center" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginBottom: 12, width: "100%", justifyContent: "center" },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, marginTop: 8, width: "100%", justifyContent: "center" },
  backBtnText: { fontSize: 14, fontWeight: "600" },
  main: { flex: 1 },
  content: { padding: 32, maxWidth: 720 },
  formCard: { padding: 24, borderRadius: 16, borderWidth: 2, marginBottom: 24 },
  formTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: "600", marginBottom: 6, textTransform: "uppercase" },
  input: { height: 46, borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 14, fontSize: 15 },
  saveBtn: { paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 8 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 80 },
  empty: { alignItems: "center", paddingVertical: 80 },
  emptyIcon: { width: 96, height: 96, borderRadius: 48, justifyContent: "center", alignItems: "center", marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
  emptySub: { fontSize: 14, textAlign: "center" },
  addrCard: { padding: 20, borderRadius: 16, marginBottom: 16 },
  addrHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  labelBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  labelText: { fontSize: 13, fontWeight: "700" },
  defaultBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  defaultText: { fontSize: 12, fontWeight: "700" },
  addrStreet: { fontSize: 15, fontWeight: "600", marginBottom: 4 },
  addrCity: { fontSize: 13, marginBottom: 12 },
  addrActions: { flexDirection: "row", gap: 8 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  actionText: { fontSize: 13, fontWeight: "600" },
});
