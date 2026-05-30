import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Text,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useTheme } from "@/hooks/useTheme";
import { useBusiness, Business } from "@/contexts/BusinessContext";
import { useAuth } from "@/contexts/AuthContext";
import { ComeYaColors } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { BusinessSidebar } from "@/components/BusinessSidebar";
import { useToast } from "@/contexts/ToastContext";
import { confirm } from "@/hooks/useWebDialog";

const BUSINESS_TYPES = [
  { id: "restaurant", name: "Restaurante", icon: "coffee" },
  { id: "market", name: "Mercado", icon: "shopping-bag" },
  { id: "bakery", name: "Panadería", icon: "award" },
  { id: "grocery", name: "Abarrotes", icon: "package" },
  { id: "pharmacy", name: "Farmacia", icon: "plus-circle" },
  { id: "other", name: "Otro", icon: "grid" },
];

const EMPTY_FORM = {
  name: "",
  description: "",
  type: "restaurant",
  address: "",
  phone: "",
  image: "",
};

export default function MyBusinessesScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute() as any;
  const { theme, isDark } = useTheme();
  const {
    businesses,
    selectedBusiness,
    isLoading,
    loadBusinesses,
    selectBusiness,
    createBusiness,
    deleteBusiness,
  } = useBusiness();
  const { showToast } = useToast();

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const inputBg = isDark ? "#2a2a2a" : "#f5f5f5";

  const [mode, setMode] = useState<"none" | "create" | "edit">("none");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  useEffect(() => {
    loadBusinesses();
    if (route.params?.openAddModal) openCreate();
  }, []);

  const getImageUrl = (img?: string) => {
    if (!img) return undefined;
    if (img.startsWith("http")) return img;
    return `${getApiUrl()}${img}`;
  };

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setMode("create");
  };

  const openEdit = (biz: any) => {
    setForm({
      name: biz.name || "",
      description: biz.description || "",
      type: biz.type || "restaurant",
      address: biz.address || "",
      phone: biz.phone || "",
      image: biz.image || "",
    });
    setEditingId(biz.id);
    setMode("edit");
  };

  const closeForm = () => {
    setMode("none");
    setEditingId(null);
  };

  const pickImage = (onUrl: (url: string) => void) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const res = await apiRequest("POST", "/api/upload/business-image", {
            image: reader.result,
          });
          const data = await res.json();
          if (data.success && data.imageUrl) onUrl(data.imageUrl);
        } catch {}
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleCreate = async () => {
    if (!form.name.trim()) {
      showToast("El nombre del negocio es requerido", "error");
      return;
    }
    setSubmitting(true);
    try {
      await createBusiness(form);
      closeForm();
      showToast("Negocio creado correctamente", "success");
    } catch (err: any) {
      showToast(err.message || "No se pudo crear el negocio", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!form.name.trim()) {
      showToast("El nombre del negocio es requerido", "error");
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest("PUT", `/api/business/${editingId}`, form);
      await loadBusinesses();
      closeForm();
      showToast("Negocio actualizado correctamente", "success");
    } catch (err: any) {
      showToast(err.message || "No se pudo actualizar el negocio", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (biz: Business) => {
    const ok = await confirm({
      title: `Eliminar "${biz.name}"`,
      message: "Esta acción no se puede deshacer.",
      confirmLabel: "Eliminar",
      variant: "danger",
    });
    if (!ok) return;
    setSubmitting(true);
    try {
      await deleteBusiness(biz.id);
      showToast("Negocio eliminado", "success");
    } catch (err: any) {
      showToast(err.message || "No se pudo eliminar el negocio", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const showForm = mode !== "none";

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <BusinessSidebar />

      <View style={s.main}>
        {/* Toolbar */}
        <View
          style={[
            s.toolbar,
            { backgroundColor: card, borderBottomColor: border },
          ]}
        >
          <View style={s.toolbarLeft}>
            <Feather name="briefcase" size={20} color={ComeYaColors.primary} />
            <Text style={[s.toolbarTitle, { color: text }]}>Mis Negocios</Text>
            <View
              style={[
                s.countChip,
                { backgroundColor: ComeYaColors.primary + "15" },
              ]}
            >
              <Text style={[s.countChipText, { color: ComeYaColors.primary }]}>
                {businesses.length}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={showForm ? closeForm : openCreate}
            style={[
              s.addBtn,
              { backgroundColor: showForm ? border : ComeYaColors.primary },
            ]}
          >
            <Feather
              name={showForm ? "x" : "plus"}
              size={16}
              color={showForm ? text : "#fff"}
            />
            <Text style={[s.addBtnText, { color: showForm ? text : "#fff" }]}>
              {showForm ? "Cancelar" : "Nuevo negocio"}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          style={s.scrollArea}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Formulario crear / editar */}
          {showForm && (
            <View
              style={[
                s.formCard,
                {
                  backgroundColor: card,
                  borderColor: ComeYaColors.primary + "40",
                },
              ]}
            >
              <Text style={[s.formTitle, { color: text }]}>
                {mode === "edit" ? "Editar negocio" : "Nuevo negocio"}
              </Text>

              {[
                {
                  key: "name",
                  label: "Nombre *",
                  placeholder: "Nombre del negocio",
                },
                {
                  key: "description",
                  label: "Descripción",
                  placeholder: "Breve descripción",
                },
                {
                  key: "address",
                  label: "Dirección",
                  placeholder: "Calle Mayor 12, Soria",
                },
                {
                  key: "phone",
                  label: "Teléfono",
                  placeholder: "+34 6XX XXX XXX",
                },
              ].map((f) => (
                <View key={f.key} style={s.field}>
                  <Text style={[s.fieldLabel, { color: sub }]}>{f.label}</Text>
                  <TextInput
                    style={[
                      s.input,
                      {
                        backgroundColor: inputBg,
                        color: text,
                        borderColor: border,
                      },
                    ]}
                    value={(form as any)[f.key]}
                    onChangeText={(v) => setForm((p) => ({ ...p, [f.key]: v }))}
                    placeholder={f.placeholder}
                    placeholderTextColor={sub}
                  />
                </View>
              ))}

              <Text style={[s.fieldLabel, { color: sub }]}>
                Tipo de negocio
              </Text>
              <View style={s.typeGrid}>
                {BUSINESS_TYPES.map((t) => (
                  <Pressable
                    key={t.id}
                    onPress={() => setForm((p) => ({ ...p, type: t.id }))}
                    style={[
                      s.typeChip,
                      {
                        backgroundColor:
                          form.type === t.id
                            ? ComeYaColors.primary + "15"
                            : inputBg,
                        borderColor:
                          form.type === t.id ? ComeYaColors.primary : border,
                      },
                    ]}
                  >
                    <Feather
                      name={t.icon as any}
                      size={14}
                      color={form.type === t.id ? ComeYaColors.primary : sub}
                    />
                    <Text
                      style={[
                        s.typeChipText,
                        {
                          color:
                            form.type === t.id ? ComeYaColors.primary : text,
                        },
                      ]}
                    >
                      {t.name}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                onPress={() =>
                  pickImage((url) => setForm((p) => ({ ...p, image: url })))
                }
                style={[
                  s.imagePicker,
                  { backgroundColor: inputBg, borderColor: border },
                ]}
              >
                {form.image ? (
                  <Image
                    source={{ uri: getImageUrl(form.image) }}
                    style={s.imagePreview}
                    contentFit="cover"
                  />
                ) : (
                  <>
                    <Feather name="camera" size={24} color={sub} />
                    <Text style={[s.imagePickerText, { color: sub }]}>
                      Subir imagen del negocio
                    </Text>
                  </>
                )}
              </Pressable>

              <View style={s.formBtns}>
                <Pressable
                  onPress={closeForm}
                  style={[s.formBtn, { borderColor: border, borderWidth: 1 }]}
                >
                  <Text style={{ color: text }}>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={mode === "edit" ? handleEdit : handleCreate}
                  disabled={submitting}
                  style={[
                    s.formBtn,
                    {
                      backgroundColor: ComeYaColors.primary,
                      opacity: submitting ? 0.6 : 1,
                    },
                  ]}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={{ color: "#fff", fontWeight: "700" }}>
                      {mode === "edit" ? "Guardar cambios" : "Crear negocio"}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}

          {/* Lista */}
          {isLoading ? (
            <View style={s.loading}>
              <ActivityIndicator color={ComeYaColors.primary} size="large" />
            </View>
          ) : businesses.length === 0 ? (
            <View style={s.empty}>
              <Feather name="briefcase" size={48} color={sub} />
              <Text style={[s.emptyTitle, { color: text }]}>Sin negocios</Text>
              <Text style={[s.emptySub, { color: sub }]}>
                Agrega tu primer negocio para comenzar
              </Text>
            </View>
          ) : (
            businesses.map((biz: any) => (
              <View
                key={biz.id}
                style={[
                  s.bizCard,
                  {
                    backgroundColor: card,
                    borderColor:
                      selectedBusiness?.id === biz.id
                        ? ComeYaColors.primary
                        : border,
                    borderWidth: selectedBusiness?.id === biz.id ? 2 : 1,
                  },
                ]}
              >
                {biz.image ? (
                  <Image
                    source={{ uri: getImageUrl(biz.image) }}
                    style={s.bizImage}
                    contentFit="cover"
                  />
                ) : (
                  <View
                    style={[
                      s.bizImagePlaceholder,
                      { backgroundColor: ComeYaColors.primary + "10" },
                    ]}
                  >
                    <Feather
                      name="image"
                      size={32}
                      color={ComeYaColors.primary}
                    />
                  </View>
                )}
                <View style={s.bizInfo}>
                  <View style={s.bizHeader}>
                    <Text
                      style={[s.bizName, { color: text }]}
                      numberOfLines={1}
                    >
                      {biz.name}
                    </Text>
                    <View
                      style={[
                        s.statusBadge,
                        {
                          backgroundColor: biz.isOpen
                            ? ComeYaColors.success + "15"
                            : border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.statusText,
                          { color: biz.isOpen ? ComeYaColors.success : sub },
                        ]}
                      >
                        {biz.isOpen ? "Abierto" : "Cerrado"}
                      </Text>
                    </View>
                  </View>
                  <Text style={[s.bizType, { color: sub }]}>
                    {BUSINESS_TYPES.find((t) => t.id === biz.type)?.name ||
                      "Negocio"}
                  </Text>
                  {biz.stats && (
                    <View style={[s.statsRow, { borderTopColor: border }]}>
                      <View style={s.statItem}>
                        <Text style={[s.statValue, { color: text }]}>
                          {biz.stats.pendingOrders}
                        </Text>
                        <Text style={[s.statLabel, { color: sub }]}>
                          Pendientes
                        </Text>
                      </View>
                      <View style={s.statItem}>
                        <Text style={[s.statValue, { color: text }]}>
                          {biz.stats.totalOrders}
                        </Text>
                        <Text style={[s.statLabel, { color: sub }]}>
                          Completados
                        </Text>
                      </View>
                      <View style={s.statItem}>
                        <Text
                          style={[s.statValue, { color: ComeYaColors.success }]}
                        >
                          €{((biz.stats.totalRevenue || 0) / 100).toFixed(0)}
                        </Text>
                        <Text style={[s.statLabel, { color: sub }]}>
                          Ingresos
                        </Text>
                      </View>
                    </View>
                  )}
                  <View style={[s.bizActions, { borderTopColor: border }]}>
                    <Pressable
                      onPress={() => selectBusiness(biz)}
                      style={s.bizAction}
                    >
                      <Feather
                        name={
                          selectedBusiness?.id === biz.id
                            ? "check-circle"
                            : "circle"
                        }
                        size={16}
                        color={
                          selectedBusiness?.id === biz.id
                            ? ComeYaColors.primary
                            : sub
                        }
                      />
                      <Text
                        style={[
                          s.bizActionText,
                          {
                            color:
                              selectedBusiness?.id === biz.id
                                ? ComeYaColors.primary
                                : sub,
                          },
                        ]}
                      >
                        {selectedBusiness?.id === biz.id
                          ? "Seleccionado"
                          : "Seleccionar"}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => openEdit(biz)}
                      style={[
                        s.bizAction,
                        { borderLeftWidth: 1, borderLeftColor: border },
                      ]}
                    >
                      <Feather
                        name="edit-2"
                        size={16}
                        color={ComeYaColors.primary}
                      />
                      <Text
                        style={[
                          s.bizActionText,
                          { color: ComeYaColors.primary },
                        ]}
                      >
                        Editar
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleDelete(biz)}
                      style={[
                        s.bizAction,
                        { borderLeftWidth: 1, borderLeftColor: border },
                      ]}
                    >
                      <Feather
                        name="trash-2"
                        size={16}
                        color={ComeYaColors.error}
                      />
                      <Text
                        style={[s.bizActionText, { color: ComeYaColors.error }]}
                      >
                        Eliminar
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "row" },
  main: { flex: 1, flexDirection: "column" },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  toolbarLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  toolbarTitle: { fontSize: 20, fontWeight: "800" },
  countChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  countChipText: { fontSize: 13, fontWeight: "700" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  addBtnText: { fontWeight: "700", fontSize: 13 },
  scrollArea: { flex: 1 },
  content: { padding: 32, maxWidth: 800 },
  formCard: { padding: 24, borderRadius: 16, borderWidth: 2, marginBottom: 24 },
  formTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  field: { marginBottom: 14 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  input: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
    marginTop: 6,
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  typeChipText: { fontSize: 13, fontWeight: "600" },
  imagePicker: {
    height: 120,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    overflow: "hidden",
  },
  imagePreview: { width: "100%", height: "100%" },
  imagePickerText: { fontSize: 13, marginTop: 8 },
  formBtns: { flexDirection: "row", gap: 10 },
  formBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  loading: { paddingVertical: 80, alignItems: "center" },
  empty: { alignItems: "center", paddingVertical: 80, gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: "700" },
  emptySub: { fontSize: 14, textAlign: "center" },
  bizCard: { borderRadius: 16, overflow: "hidden", marginBottom: 16 },
  bizImage: { width: "100%", height: 140 },
  bizImagePlaceholder: {
    width: "100%",
    height: 140,
    justifyContent: "center",
    alignItems: "center",
  },
  bizInfo: { padding: 16 },
  bizHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  bizName: { fontSize: 18, fontWeight: "700", flex: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: "700" },
  bizType: { fontSize: 13, marginBottom: 12 },
  statsRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingTop: 12,
    marginBottom: 12,
  },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 18, fontWeight: "800" },
  statLabel: { fontSize: 11, marginTop: 2 },
  bizActions: { flexDirection: "row", borderTopWidth: 1, paddingTop: 12 },
  bizAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  bizActionText: { fontSize: 13, fontWeight: "600" },
});
