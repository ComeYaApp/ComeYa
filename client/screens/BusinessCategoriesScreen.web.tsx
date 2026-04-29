// BusinessCategoriesScreen.web.tsx
import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Pressable, Text, TextInput, Switch, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { ComeYaColors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface Category { id: string; name: string; description: string; isActive: boolean; }

export default function BusinessCategoriesScreen() {
  const navigation = useNavigation<any>();
  const { theme, isDark } = useTheme();
  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const inputBg = isDark ? "#2a2a2a" : "#f5f5f5";

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });

  const load = async () => {
    try {
      const res = await apiRequest("GET", "/api/business/categories");
      const data = await res.json();
      if (data.success) setCategories(data.categories);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm({ name: "", description: "" }); setShowForm(true); };
  const openEdit = (cat: Category) => { setEditing(cat); setForm({ name: cat.name, description: cat.description }); setShowForm(true); };

  const handleSave = async () => {
    try {
      if (editing) await apiRequest("PUT", `/api/business/categories/${editing.id}`, form);
      else await apiRequest("POST", "/api/business/categories", form);
      setShowForm(false);
      load();
    } catch { alert("Error al guardar categoría"); }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    await apiRequest("PUT", `/api/business/categories/${id}`, { isActive: !isActive });
    load();
  };

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <View style={[s.sidebar, { backgroundColor: card, borderRightColor: border }]}>
        <View style={[s.iconCircle, { backgroundColor: ComeYaColors.primary + "15" }]}>
          <Feather name="folder" size={28} color={ComeYaColors.primary} />
        </View>
        <Text style={[s.sideTitle, { color: text }]}>Categorías</Text>
        <Text style={[s.sideSub, { color: sub }]}>{categories.length} categoría{categories.length !== 1 ? "s" : ""}</Text>
        <Pressable onPress={openAdd} style={[s.addBtn, { backgroundColor: ComeYaColors.primary }]}>
          <Feather name="plus" size={18} color="#fff" />
          <Text style={s.addBtnText}>Nueva categoría</Text>
        </Pressable>
        <Pressable onPress={() => navigation.goBack()} style={[s.backBtn, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="arrow-left" size={16} color={text} />
          <Text style={[s.backBtnText, { color: text }]}>Volver</Text>
        </Pressable>
      </View>

      <ScrollView style={s.main} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {showForm && (
          <View style={[s.formCard, { backgroundColor: card, borderColor: ComeYaColors.primary + "40" }]}>
            <Text style={[s.formTitle, { color: text }]}>{editing ? "Editar categoría" : "Nueva categoría"}</Text>
            <Text style={[s.fieldLabel, { color: sub }]}>Nombre *</Text>
            <TextInput style={[s.input, { backgroundColor: inputBg, color: text, borderColor: border }]} value={form.name} onChangeText={v => setForm(p => ({ ...p, name: v }))} placeholder="Entradas, Platos principales..." placeholderTextColor={sub} />
            <Text style={[s.fieldLabel, { color: sub }]}>Descripción</Text>
            <TextInput style={[s.input, s.textarea, { backgroundColor: inputBg, color: text, borderColor: border }]} value={form.description} onChangeText={v => setForm(p => ({ ...p, description: v }))} placeholder="Descripción..." placeholderTextColor={sub} multiline numberOfLines={3} />
            <View style={s.formBtns}>
              <Pressable onPress={() => setShowForm(false)} style={[s.formBtn, { borderColor: border, borderWidth: 1 }]}><Text style={{ color: text }}>Cancelar</Text></Pressable>
              <Pressable onPress={handleSave} style={[s.formBtn, { backgroundColor: ComeYaColors.primary }]}><Text style={{ color: "#fff", fontWeight: "700" }}>Guardar</Text></Pressable>
            </View>
          </View>
        )}

        {loading ? <ActivityIndicator color={ComeYaColors.primary} style={{ marginTop: 40 }} /> : categories.length === 0 ? (
          <View style={s.empty}>
            <Feather name="folder" size={48} color={sub} />
            <Text style={[s.emptyText, { color: sub }]}>No hay categorías</Text>
          </View>
        ) : categories.map(cat => (
          <View key={cat.id} style={[s.catRow, { backgroundColor: card, borderColor: border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.catName, { color: text }]}>{cat.name}</Text>
              {cat.description ? <Text style={[s.catDesc, { color: sub }]}>{cat.description}</Text> : null}
            </View>
            <Pressable onPress={() => openEdit(cat)} style={s.editBtn}><Feather name="edit-2" size={16} color={ComeYaColors.primary} /></Pressable>
            <Switch value={cat.isActive} onValueChange={() => toggleActive(cat.id, cat.isActive)} trackColor={{ false: "#ccc", true: ComeYaColors.primary }} thumbColor="#fff" />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "row" },
  sidebar: { width: 240, padding: 24, borderRightWidth: 1, paddingTop: 40, alignItems: "center" },
  iconCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  sideTitle: { fontSize: 20, fontWeight: "800", marginBottom: 4 },
  sideSub: { fontSize: 13, marginBottom: 20 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginBottom: 10, width: "100%", justifyContent: "center" },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, width: "100%", justifyContent: "center" },
  backBtnText: { fontSize: 14, fontWeight: "600" },
  main: { flex: 1 },
  content: { padding: 32, maxWidth: 720 },
  formCard: { padding: 24, borderRadius: 16, borderWidth: 2, marginBottom: 20 },
  formTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: "600", marginBottom: 6, textTransform: "uppercase", marginTop: 10 },
  input: { height: 46, borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 14, fontSize: 15 },
  textarea: { height: 80, paddingTop: 10 },
  formBtns: { flexDirection: "row", gap: 10, marginTop: 16 },
  formBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 16 },
  catRow: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  catName: { fontSize: 15, fontWeight: "700" },
  catDesc: { fontSize: 13, marginTop: 2 },
  editBtn: { padding: 8, marginRight: 8 },
});
