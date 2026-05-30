import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";

const PRIMARY = "#DC2626";

// Iconos Feather disponibles para categorías
const ICON_OPTIONS = [
  "coffee",
  "shopping-bag",
  "plus-circle",
  "package",
  "tool",
  "book",
  "grid",
  "home",
  "truck",
  "heart",
  "star",
  "zap",
  "box",
  "scissors",
  "music",
  "camera",
  "monitor",
  "smartphone",
  "watch",
  "sun",
];

const COLOR_OPTIONS = [
  "#F97316",
  "#10B981",
  "#3B82F6",
  "#8B5CF6",
  "#F59E0B",
  "#EC4899",
  "#6B7280",
  "#EF4444",
  "#06B6D4",
  "#84CC16",
  "#DC2626",
  "#7C3AED",
  "#059669",
  "#D97706",
  "#2563EB",
];

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  description?: string;
  isActive: boolean;
  displayOrder: number;
  createdAt?: string;
}

const EMPTY_FORM = {
  name: "",
  slug: "",
  icon: "grid",
  color: "#6B7280",
  description: "",
  isActive: true,
  displayOrder: 0,
};

interface Props {
  theme?: any;
  showToast?: (msg: string, type?: string) => void;
}

export const CategoriesTab: React.FC<Props> = () => {
  const { isDark } = useTheme();
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editing, setEditing] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);

  const bg = isDark ? "#0d0d0d" : "#f2f3f5";
  const card = isDark ? "#1a1a1a" : "#fff";
  const border = isDark ? "#2a2a2a" : "#ebebeb";
  const text = isDark ? "#fff" : "#111";
  const sub = isDark ? "#666" : "#aaa";
  const inputBg = isDark ? "#222" : "#f8f8f8";

  const load = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/admin/business-categories");
      const data = await res.json();
      setCats(data?.categories ?? []);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setMsg(null);
    setShowForm(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setForm({
      name: cat.name,
      slug: cat.slug,
      icon: cat.icon,
      color: cat.color,
      description: cat.description ?? "",
      isActive: cat.isActive,
      displayOrder: cat.displayOrder,
    });
    setMsg(null);
    setShowForm(true);
  };

  const autoSlug = (name: string) =>
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

  const save = async () => {
    if (!form.name.trim()) {
      setMsg({ ok: false, text: "El nombre es requerido" });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const body = {
        ...form,
        slug: form.slug || autoSlug(form.name),
        displayOrder: Number(form.displayOrder),
      };
      const res = editing
        ? await apiRequest(
            "PUT",
            `/api/admin/business-categories/${editing.id}`,
            body,
          )
        : await apiRequest("POST", "/api/admin/business-categories", body);
      const data = await res.json();
      if (data.success) {
        setMsg({
          ok: true,
          text: editing ? "Categoría actualizada" : "Categoría creada",
        });
        load();
        if (!editing) {
          setForm({ ...EMPTY_FORM });
          setShowForm(false);
        }
      } else {
        setMsg({ ok: false, text: data.error ?? "Error al guardar" });
      }
    } catch {
      setMsg({ ok: false, text: "Error de conexión" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (cat: Category) => {
    if (
      !window.confirm(
        `¿Eliminar la categoría "${cat.name}"? Los negocios con este tipo no se verán afectados.`,
      )
    )
      return;
    setDeleting(cat.id);
    try {
      await apiRequest("DELETE", `/api/admin/business-categories/${cat.id}`);
      setCats((prev) => prev.filter((c) => c.id !== cat.id));
    } catch {
    } finally {
      setDeleting(null);
    }
  };

  const toggleActive = async (cat: Category) => {
    try {
      await apiRequest("PUT", `/api/admin/business-categories/${cat.id}`, {
        isActive: !cat.isActive,
      });
      setCats((prev) =>
        prev.map((c) =>
          c.id === cat.id ? { ...c, isActive: !c.isActive } : c,
        ),
      );
    } catch {}
  };

  if (loading)
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: bg,
        }}
      >
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: bg, flexDirection: "row" }}>
      {/* ── Lista ── */}
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={[hd.bar, { backgroundColor: card, borderBottomColor: border }]}
        >
          <View style={[hd.icon, { backgroundColor: "#8B5CF615" }]}>
            <Feather name="grid" size={16} color="#8B5CF6" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[hd.title, { color: text }]}>
              Categorías de negocios
            </Text>
            <Text style={[hd.sub, { color: sub }]}>
              {cats.length} categorías · se usan al registrar negocios
            </Text>
          </View>
          <TouchableOpacity
            onPress={openCreate}
            style={[hd.addBtn, { backgroundColor: PRIMARY }]}
          >
            <Feather name="plus" size={14} color="#fff" />
            <Text style={hd.addTxt}>Nueva categoría</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, gap: 10 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={PRIMARY}
            />
          }
        >
          {cats.length === 0 ? (
            <View
              style={{ alignItems: "center", paddingVertical: 60, gap: 12 }}
            >
              <Feather name="grid" size={40} color={sub} />
              <Text style={{ color: sub, fontSize: 15 }}>
                Sin categorías. Pulsa "Nueva categoría" para empezar.
              </Text>
            </View>
          ) : (
            cats.map((cat) => (
              <View
                key={cat.id}
                style={[
                  li.card,
                  {
                    backgroundColor: card,
                    borderColor: border,
                    borderLeftColor: cat.color,
                  },
                ]}
              >
                <View style={li.row}>
                  {/* Icon */}
                  <View
                    style={[li.iconWrap, { backgroundColor: cat.color + "20" }]}
                  >
                    <Feather
                      name={cat.icon as any}
                      size={18}
                      color={cat.color}
                    />
                  </View>

                  {/* Info */}
                  <View style={{ flex: 1 }}>
                    <View style={li.nameRow}>
                      <Text style={[li.name, { color: text }]}>{cat.name}</Text>
                      <View
                        style={[
                          li.slugPill,
                          { backgroundColor: isDark ? "#333" : "#f0f0f0" },
                        ]}
                      >
                        <Text style={[li.slugTxt, { color: sub }]}>
                          {cat.slug}
                        </Text>
                      </View>
                      <View
                        style={[
                          li.orderPill,
                          { backgroundColor: cat.color + "15" },
                        ]}
                      >
                        <Text style={[li.orderTxt, { color: cat.color }]}>
                          #{cat.displayOrder}
                        </Text>
                      </View>
                    </View>
                    {cat.description && (
                      <Text style={[li.desc, { color: sub }]} numberOfLines={1}>
                        {cat.description}
                      </Text>
                    )}
                  </View>

                  {/* Actions */}
                  <View style={li.actions}>
                    <TouchableOpacity
                      onPress={() => toggleActive(cat)}
                      style={[
                        li.actionBtn,
                        {
                          backgroundColor: cat.isActive
                            ? "#10B98115"
                            : "#EF444415",
                        },
                      ]}
                    >
                      <View
                        style={[
                          li.dot,
                          {
                            backgroundColor: cat.isActive
                              ? "#10B981"
                              : "#EF4444",
                          },
                        ]}
                      />
                      <Text
                        style={[
                          li.actionTxt,
                          { color: cat.isActive ? "#10B981" : "#EF4444" },
                        ]}
                      >
                        {cat.isActive ? "Activa" : "Inactiva"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => openEdit(cat)}
                      style={[li.actionBtn, { backgroundColor: "#3B82F615" }]}
                    >
                      <Feather name="edit-2" size={13} color="#3B82F6" />
                      <Text style={[li.actionTxt, { color: "#3B82F6" }]}>
                        Editar
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => remove(cat)}
                      disabled={deleting === cat.id}
                      style={[li.actionBtn, { backgroundColor: "#EF444415" }]}
                    >
                      {deleting === cat.id ? (
                        <ActivityIndicator size="small" color="#EF4444" />
                      ) : (
                        <Feather name="trash-2" size={13} color="#EF4444" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>

      {/* ── Panel crear/editar ── */}
      {showForm && (
        <View
          style={[fp.panel, { backgroundColor: card, borderLeftColor: border }]}
        >
          <View style={[fp.header, { borderBottomColor: border }]}>
            <Text style={[fp.title, { color: text }]}>
              {editing ? "Editar categoría" : "Nueva categoría"}
            </Text>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <Feather name="x" size={18} color={sub} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20, gap: 14 }}
          >
            {/* Nombre */}
            <View>
              <Text style={[fp.label, { color: sub }]}>NOMBRE *</Text>
              <TextInput
                style={[
                  fp.input,
                  {
                    backgroundColor: inputBg,
                    borderColor: border,
                    color: text,
                  },
                ]}
                value={form.name}
                onChangeText={(v) =>
                  setForm((p) => ({
                    ...p,
                    name: v,
                    slug: p.slug || autoSlug(v),
                  }))
                }
                placeholder="Ej: Farmacias"
                placeholderTextColor={sub}
              />
            </View>

            {/* Slug */}
            <View>
              <Text style={[fp.label, { color: sub }]}>
                SLUG (identificador único)
              </Text>
              <TextInput
                style={[
                  fp.input,
                  {
                    backgroundColor: inputBg,
                    borderColor: border,
                    color: text,
                  },
                ]}
                value={form.slug}
                onChangeText={(v) => setForm((p) => ({ ...p, slug: v }))}
                placeholder="Ej: pharmacy"
                placeholderTextColor={sub}
                autoCapitalize="none"
              />
            </View>

            {/* Descripción */}
            <View>
              <Text style={[fp.label, { color: sub }]}>DESCRIPCIÓN</Text>
              <TextInput
                style={[
                  fp.input,
                  {
                    backgroundColor: inputBg,
                    borderColor: border,
                    color: text,
                    minHeight: 60,
                  },
                ]}
                value={form.description}
                onChangeText={(v) => setForm((p) => ({ ...p, description: v }))}
                placeholder="Describe esta categoría..."
                placeholderTextColor={sub}
                multiline
              />
            </View>

            {/* Orden */}
            <View>
              <Text style={[fp.label, { color: sub }]}>ORDEN DE APARICIÓN</Text>
              <TextInput
                style={[
                  fp.input,
                  {
                    backgroundColor: inputBg,
                    borderColor: border,
                    color: text,
                  },
                ]}
                value={String(form.displayOrder)}
                onChangeText={(v) =>
                  setForm((p) => ({ ...p, displayOrder: parseInt(v) || 0 }))
                }
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={sub}
              />
            </View>

            {/* Icono */}
            <View>
              <Text style={[fp.label, { color: sub }]}>ICONO</Text>
              <View style={fp.grid}>
                {ICON_OPTIONS.map((ic) => (
                  <TouchableOpacity
                    key={ic}
                    onPress={() => setForm((p) => ({ ...p, icon: ic }))}
                    style={[
                      fp.iconBtn,
                      {
                        backgroundColor:
                          form.icon === ic ? form.color + "25" : inputBg,
                        borderColor: form.icon === ic ? form.color : border,
                      },
                    ]}
                  >
                    <Feather
                      name={ic as any}
                      size={16}
                      color={form.icon === ic ? form.color : sub}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Color */}
            <View>
              <Text style={[fp.label, { color: sub }]}>COLOR</Text>
              <View style={fp.grid}>
                {COLOR_OPTIONS.map((col) => (
                  <TouchableOpacity
                    key={col}
                    onPress={() => setForm((p) => ({ ...p, color: col }))}
                    style={[
                      fp.colorBtn,
                      {
                        backgroundColor: col,
                        borderWidth: form.color === col ? 3 : 1,
                        borderColor: form.color === col ? text : "transparent",
                      },
                    ]}
                  />
                ))}
              </View>
            </View>

            {/* Preview */}
            <View
              style={[
                fp.preview,
                {
                  backgroundColor: form.color + "15",
                  borderColor: form.color + "40",
                },
              ]}
            >
              <View
                style={[fp.previewIcon, { backgroundColor: form.color + "25" }]}
              >
                <Feather name={form.icon as any} size={20} color={form.color} />
              </View>
              <View>
                <Text style={[fp.previewName, { color: form.color }]}>
                  {form.name || "Nombre de categoría"}
                </Text>
                <Text style={[fp.previewSlug, { color: sub }]}>
                  {form.slug || autoSlug(form.name) || "slug"}
                </Text>
              </View>
            </View>

            {/* Activa */}
            <TouchableOpacity
              onPress={() => setForm((p) => ({ ...p, isActive: !p.isActive }))}
              style={[
                fp.toggleRow,
                {
                  backgroundColor: form.isActive ? "#10B98115" : "#EF444415",
                  borderColor: form.isActive ? "#10B981" : "#EF4444",
                },
              ]}
            >
              <View
                style={[
                  fp.toggleDot,
                  { backgroundColor: form.isActive ? "#10B981" : "#EF4444" },
                ]}
              />
              <Text
                style={[
                  fp.toggleTxt,
                  { color: form.isActive ? "#10B981" : "#EF4444" },
                ]}
              >
                {form.isActive ? "Categoría activa" : "Categoría inactiva"}
              </Text>
            </TouchableOpacity>

            {/* Feedback */}
            {msg && (
              <View
                style={[
                  fp.msg,
                  { backgroundColor: msg.ok ? "#10B98115" : "#EF444415" },
                ]}
              >
                <Feather
                  name={msg.ok ? "check-circle" : "alert-circle"}
                  size={14}
                  color={msg.ok ? "#10B981" : "#EF4444"}
                />
                <Text
                  style={[fp.msgTxt, { color: msg.ok ? "#10B981" : "#EF4444" }]}
                >
                  {msg.text}
                </Text>
              </View>
            )}

            {/* Guardar */}
            <TouchableOpacity
              onPress={save}
              disabled={saving}
              style={[fp.saveBtn, { backgroundColor: saving ? sub : PRIMARY }]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name="check" size={15} color="#fff" />
                  <Text style={fp.saveTxt}>
                    {editing ? "Guardar cambios" : "Crear categoría"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const hd = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 15, fontWeight: "700" },
  sub: { fontSize: 11, marginTop: 1 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },
});

const li = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, borderLeftWidth: 3, padding: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 3,
  },
  name: { fontSize: 14, fontWeight: "700" },
  slugPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  slugTxt: { fontSize: 10, fontWeight: "600" },
  orderPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  orderTxt: { fontSize: 10, fontWeight: "700" },
  desc: { fontSize: 11 },
  actions: { flexDirection: "row", gap: 6 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  actionTxt: { fontSize: 11, fontWeight: "600" },
  dot: { width: 6, height: 6, borderRadius: 3 },
});

const fp = StyleSheet.create({
  panel: { width: 340, borderLeftWidth: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
    borderBottomWidth: 1,
  },
  title: { fontSize: 15, fontWeight: "700" },
  label: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  colorBtn: { width: 32, height: 32, borderRadius: 16 },
  preview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  previewIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  previewName: { fontSize: 15, fontWeight: "700" },
  previewSlug: { fontSize: 11, marginTop: 2 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  toggleDot: { width: 8, height: 8, borderRadius: 4 },
  toggleTxt: { fontSize: 13, fontWeight: "700" },
  msg: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 8,
  },
  msgTxt: { fontSize: 12, fontWeight: "600" },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
  },
  saveTxt: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
