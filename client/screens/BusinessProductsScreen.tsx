import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Switch,
  TextInput,
  Modal,
  ScrollView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useBusiness } from "@/contexts/BusinessContext";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

export default function BusinessProductsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { selectedBusiness, businesses } = useBusiness();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [products, setProducts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const filteredProducts = products.filter(
    (p: any) => !search || p.name.toLowerCase().includes(search.toLowerCase()),
  );

  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    image: "",
  });

  const loadProducts = async () => {
    try {
      const url = selectedBusiness
        ? `/api/business/products?businessId=${selectedBusiness.id}`
        : "/api/business/products";
      const response = await apiRequest("GET", url);
      const data = await response.json();
      if (data.success) {
        setProducts(data.products);
      }
    } catch (error) {
      console.error("Error loading products:", error);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [selectedBusiness?.id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProducts();
    setRefreshing(false);
  };

  const toggleAvailability = async (
    productId: string,
    currentStatus: boolean,
  ) => {
    try {
      await apiRequest(
        "PUT",
        `/api/business/products/${productId}/availability`,
        {
          isAvailable: !currentStatus,
        },
      );
      loadProducts();
    } catch (error) {
      console.error("Error updating product:", error);
    }
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setForm({ name: "", description: "", price: "", image: "" });
    setShowModal(true);
  };

  const openEditModal = (product: any) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      description: product.description || "",
      price: (product.price / 100).toString(),
      image: product.image || "",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      const priceInCents = Math.round(parseFloat(form.price) * 100);

      if (editingProduct) {
        await apiRequest("PUT", `/api/business/products/${editingProduct.id}`, {
          name: form.name,
          description: form.description,
          price: priceInCents,
          image:
            form.image ||
            "https://res.cloudinary.com/dkuj3vq57/image/upload/v1/comeya/placeholder-food.jpg",
        });
      } else {
        await apiRequest("POST", "/api/business/products", {
          name: form.name,
          description: form.description,
          price: priceInCents,
          image:
            form.image ||
            "https://res.cloudinary.com/dkuj3vq57/image/upload/v1/comeya/placeholder-food.jpg",
        });
      }

      setShowModal(false);
      loadProducts();
    } catch (error) {
      console.error("Error saving product:", error);
      alert("Error al guardar producto");
    }
  };

  const pickImage = async (useCamera: boolean) => {
    // Solicitar permisos antes de abrir cámara o galería
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        alert("Se necesita permiso para usar la cámara");
        return;
      }
    } else {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        alert("Se necesita permiso para acceder a la galería");
        return;
      }
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        })
      : await ImagePicker.launchImageLibraryAsync({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });

    const asset = result?.assets?.[0];
    if (!result.canceled && asset?.uri) {
      await uploadProductImage(asset.uri);
    } else if (!result.canceled) {
      alert("No se pudo leer la imagen seleccionada");
    }
  };

  const uploadProductImage = async (uri: string) => {
    setIsUploadingImage(true);
    try {
      let imageData: string;

      if (Platform.OS === "web") {
        const response = await fetch(uri);
        const blob = await response.blob();
        const reader = new FileReader();
        imageData = await new Promise((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        const encoding = (FileSystem as any)?.EncodingType?.Base64 || "base64";
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding,
        });
        const extension = uri.split(".").pop()?.toLowerCase() || "jpg";
        const mimeType = extension === "png" ? "image/png" : "image/jpeg";
        imageData = `data:${mimeType};base64,${base64}`;
      }

      // Usar el endpoint correcto de upload de imágenes
      const apiResponse = await apiRequest(
        "POST",
        "/api/upload/product-image",
        {
          image: imageData,
        },
      );

      const data = await apiResponse.json();

      if (data.success && data.imageUrl) {
        // data.imageUrl ya es una URL absoluta de Cloudinary
        setForm({ ...form, image: data.imageUrl });
      } else {
        throw new Error(data.error || "Error al subir imagen");
      }
    } catch (error: any) {
      console.error("Error uploading product image:", error);
      alert("No se pudo subir la imagen. Intenta con otra imagen o una URL.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleDelete = async (productId: string) => {
    if (typeof window !== "undefined" && window.confirm) {
      if (!window.confirm("¿Eliminar este producto?")) return;
    }

    try {
      await apiRequest("DELETE", `/api/business/products/${productId}`);
      loadProducts();
    } catch (error) {
      console.error("Error deleting product:", error);
    }
  };

  const renderProduct = ({ item }: { item: any }) => (
    <View
      style={[styles.productCard, { backgroundColor: theme.card }, Shadows.sm]}
    >
      <Image
        source={
          item.image
            ? { uri: item.image }
            : require("../../assets/images/delivery-hero.png")
        }
        style={styles.productImage}
        contentFit="cover"
      />
      <Pressable onPress={() => openEditModal(item)} style={styles.productInfo}>
        <ThemedText type="h4" numberOfLines={1}>
          {item.name}
        </ThemedText>
        <ThemedText
          type="caption"
          style={{ color: theme.textSecondary }}
          numberOfLines={2}
        >
          {item.description}
        </ThemedText>
        <ThemedText
          type="h4"
          style={{ color: ComeYaColors.primary, marginTop: Spacing.xs }}
        >
          €{(item.price / 100).toFixed(2)}
        </ThemedText>
      </Pressable>
      <View style={styles.productActions}>
        <Pressable
          onPress={() => handleDelete(item.id)}
          style={{ marginBottom: Spacing.sm }}
        >
          <Feather name="trash-2" size={20} color={ComeYaColors.error} />
        </Pressable>
        <Switch
          value={item.isAvailable === 1 || item.isAvailable === true}
          onValueChange={() =>
            toggleAvailability(
              item.id,
              item.isAvailable === 1 || item.isAvailable === true,
            )
          }
          trackColor={{ false: "#767577", true: ComeYaColors.primary }}
          thumbColor="#fff"
        />
      </View>
    </View>
  );

  return (
    <LinearGradient
      colors={[
        theme.gradientStart || "#FFFFFF",
        theme.gradientEnd || "#F5F5F5",
      ]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <View style={{ flex: 1 }}>
          <ThemedText type="h2">Productos</ThemedText>
          {businesses.length > 1 ? (
            <Pressable
              style={styles.businessSelector}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate("MyBusinesses");
              }}
            >
              <ThemedText
                type="caption"
                style={{ color: ComeYaColors.primary }}
              >
                {selectedBusiness?.name || "Seleccionar negocio"}
              </ThemedText>
              <Feather
                name="chevron-down"
                size={14}
                color={ComeYaColors.primary}
              />
            </Pressable>
          ) : selectedBusiness ? (
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {selectedBusiness.name}
            </ThemedText>
          ) : null}
        </View>
        <Pressable
          onPress={openAddModal}
          style={[styles.addButton, { backgroundColor: ComeYaColors.primary }]}
        >
          <Feather name="plus" size={24} color="#FFF" />
        </Pressable>
      </View>

      <View
        style={[
          styles.searchBar,
          { backgroundColor: theme.backgroundSecondary },
        ]}
      >
        <Feather name="search" size={16} color={theme.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar producto..."
          placeholderTextColor={theme.textSecondary}
        />
      </View>
      <FlatList
        data={filteredProducts}
        keyExtractor={(item: any) => item.id}
        renderItem={renderProduct}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={ComeYaColors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="package" size={64} color={theme.textSecondary} />
            <ThemedText
              type="h4"
              style={{ color: theme.textSecondary, marginTop: Spacing.lg }}
            >
              No hay productos
            </ThemedText>
          </View>
        }
      />

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h3">
                {editingProduct ? "Editar Producto" : "Agregar Producto"}
              </ThemedText>
              <Pressable onPress={() => setShowModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              <ThemedText type="small" style={{ marginBottom: Spacing.xs }}>
                Nombre
              </ThemedText>
              <TextInput
                value={form.name}
                onChangeText={(text) => setForm({ ...form, name: text })}
                style={[
                  styles.input,
                  { backgroundColor: theme.background, color: theme.text },
                ]}
                placeholder="Tacos al Pastor"
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
                placeholder="Deliciosos tacos..."
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={3}
              />

              <ThemedText
                type="small"
                style={{ marginBottom: Spacing.xs, marginTop: Spacing.md }}
              >
                Precio
              </ThemedText>
              <TextInput
                value={form.price}
                onChangeText={(text) => setForm({ ...form, price: text })}
                style={[
                  styles.input,
                  { backgroundColor: theme.background, color: theme.text },
                ]}
                placeholder="25.00"
                placeholderTextColor={theme.textSecondary}
                keyboardType="decimal-pad"
              />

              <ThemedText
                type="small"
                style={{ marginBottom: Spacing.xs, marginTop: Spacing.md }}
              >
                Imagen
              </ThemedText>
              <View style={styles.imagePickerContainer}>
                <Pressable
                  onPress={() => pickImage(true)}
                  style={[
                    styles.imageButton,
                    { backgroundColor: theme.background },
                  ]}
                >
                  <Feather name="camera" size={20} color={theme.text} />
                  <ThemedText type="small" style={{ marginLeft: Spacing.xs }}>
                    Cámara
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => pickImage(false)}
                  style={[
                    styles.imageButton,
                    { backgroundColor: theme.background },
                  ]}
                >
                  <Feather name="image" size={20} color={theme.text} />
                  <ThemedText type="small" style={{ marginLeft: Spacing.xs }}>
                    Galería
                  </ThemedText>
                </Pressable>
              </View>
              {isUploadingImage ? (
                <View
                  style={[
                    styles.previewImage,
                    {
                      justifyContent: "center",
                      alignItems: "center",
                      backgroundColor: theme.backgroundSecondary,
                    },
                  ]}
                >
                  <ActivityIndicator
                    size="large"
                    color={ComeYaColors.primary}
                  />
                  <ThemedText type="small" style={{ marginTop: Spacing.sm }}>
                    Subiendo imagen...
                  </ThemedText>
                </View>
              ) : form.image ? (
                <Image
                  source={{ uri: form.image }}
                  style={styles.previewImage}
                  contentFit="cover"
                />
              ) : null}
              <TextInput
                value={form.image}
                onChangeText={(text) => setForm({ ...form, image: text })}
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.background,
                    color: theme.text,
                    marginTop: Spacing.sm,
                  },
                ]}
                placeholder="O pega una URL de imagen"
                placeholderTextColor={theme.textSecondary}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable
                onPress={() => setShowModal(false)}
                style={[
                  styles.modalButton,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <ThemedText type="body">Cancelar</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleSave}
                style={[
                  styles.modalButton,
                  { backgroundColor: ComeYaColors.primary },
                ]}
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
  businessSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing["4xl"],
  },
  productCard: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
  },
  productInfo: {
    flex: 1,
    marginLeft: Spacing.md,
    justifyContent: "center",
  },
  productActions: {
    justifyContent: "center",
    marginLeft: Spacing.sm,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
  },
  searchInput: { flex: 1, fontSize: 15 },
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
  imagePickerContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  imageButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  previewImage: {
    width: "100%",
    height: 200,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
});