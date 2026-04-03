import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Modal,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface Category {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
}

export default function BusinessCategoriesScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [categories, setCategories] = useState<Category[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await apiRequest("GET", "/api/business/categories");
      const data = await response.json();
      if (data.success) {
        setCategories(data.categories);
      }
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  };

  const openAddModal = () => {
    setEditingCategory(null);
    setForm({ name: "", description: "" });
    setShowModal(true);
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setForm({ name: category.name, description: category.description });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      if (editingCategory) {
        await apiRequest("PUT", `/api/business/categories/${editingCategory.id}`, form);
      } else {
        await apiRequest("POST", "/api/business/categories", form);
      }
      setShowModal(false);
      loadCategories();
    } catch (error) {
      console.error("Error saving category:", error);
      alert("Error al guardar categoría");
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      await apiRequest("PUT", `/api/business/categories/${id}`, { isActive: !isActive });
      loadCategories();
    } catch (error) {
      console.error("Error updating category:", error);
    }
  };

  const renderCategory = ({ item }: { item: Category }) => (
    <View style={[styles.categoryCard, { backgroundColor: theme.card }, Shadows.sm]}>
      <Pressable onPress={() => openEditModal(item)} style={styles.categoryInfo}>
        <ThemedText type="h4">{item.name}</ThemedText>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
          {item.description}
        </ThemedText>
      </Pressable>
      <Switch
        value={item.isActive}
        onValueChange={() => toggleActive(item.id, item.isActive)}
        trackColor={{ false: "#767577", true: ComeYaColors.primary }}
        thumbColor="#fff"
      />
    </View>
  );

  return (
    <LinearGradient
      colors={[theme.gradientStart || '#FFFFFF', theme.gradientEnd || '#F5F5F5']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <ThemedText type="h2">Categorías</ThemedText>
        <Pressable
          onPress={openAddModal}
          style={[styles.addButton, { backgroundColor: ComeYaColors.primary }]}
        >
          <Feather name="plus" size={24} color="#FFF" />
        </Pressable>
      </View>

      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        renderItem={renderCategory}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="folder" size={64} color={theme.textSecondary} />
            <ThemedText
              type="h4"
              style={{ color: theme.textSecondary, marginTop: Spacing.lg }}
            >
              No hay categorías
            </ThemedText>
          </View>
        }
      />

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h3">
                {editingCategory ? "Editar Categoría" : "Nueva Categoría"}
              </ThemedText>
              <Pressable onPress={() => setShowModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              <ThemedText type="small" style={{ marginBottom: Spacing.xs }}>
                Nombre
              </ThemedText>
              <TextInput
                value={form.name}
                onChangeText={(text) => setForm({ ...form, name: text })}
                style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
                placeholder="Entradas, Platos principales..."
                placeholderTextColor={theme.textSecondary}
              />

              <ThemedText
                type="small"
                style={{ marginBottom: Spacing.xs, marginTop: Spacing.md }}
              >
                Descripción
              </ThemedText>
              <TextInput
                value={form.description}
                onChangeText={(text) => setForm({ ...form, description: text })}
                style={[
                  styles.input,
                  styles.textArea,
                  { backgroundColor: theme.background, color: theme.text },
                ]}
                placeholder="Descripción de la categoría..."
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.modalFooter}>
              <Pressable
                onPress={() => setShowModal(false)}
                style={[styles.modalButton, { backgroundColor: theme.backgroundSecondary }]}
              >
                <ThemedText type="body">Cancelar</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleSave}
                style={[styles.modalButton, { backgroundColor: ComeYaColors.primary }]}
              >
                <ThemedText type="body" style={{ color: "#FFF" }}>
                  Guardar
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing["4xl"],
  },
  categoryCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  categoryInfo: {
    flex: 1,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["4xl"],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  modalBody: {
    padding: Spacing.lg,
  },
  modalFooter: {
    flexDirection: "row",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  modalButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  input: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
});
