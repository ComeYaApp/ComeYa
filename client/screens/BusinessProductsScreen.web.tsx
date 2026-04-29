import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Pressable, Text, TextInput, Switch, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useTheme } from "@/hooks/useTheme";
import { useBusiness } from "@/contexts/BusinessContext";
import { useNavigation } from "@react-navigation/native";
import { ComeYaColors, Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { BusinessSidebar } from "@/components/BusinessSidebar";

export default function BusinessProductsScreen() {
  const { theme, isDark } = useTheme();
  const { selectedBusiness, businesses } = useBusiness();
  const navigation = useNavigation<any>();

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const inputBg = isDark ? "#2a2a2a" : "#f5f5f5";

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", description: "", price: "", image: "" });

  const loadProducts = async () => {
    try {
      const url = selectedBusiness
        ? `/api/business/products?businessId=${selectedBusiness.id}`
        : "/api/business/products";
      const res = await apiRequest("GET", url);
      const data = await res.json();
      if (data.success) setProducts(data.products);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { loadProducts(); }, [selectedBusiness?.id]);

  const openAdd = () => { setEditingProduct(null); setForm({ name: "", description: "", price: "", image: "" }); setShowForm(true); };
  const openEdit = (p: any) => { setEditingProduct(p); setForm({ name: p.name, description: p.description || "", price: (p.price / 100).toString(), image: p.image || "" }); setShowForm(true); };

  const pickImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsUploadingImage(true);
      try {
        const reader = new FileReader();
        const imageData: string = await new Promise((res, rej) => {
          reader.onloadend = () => res(reader.result as string);
          reader.onerror = rej;
          reader.readAsDataURL(file);
        });
        const r = await apiRequest("POST", "/api/business/product-image", { image: imageData });
        const d = await r.json();
        if (d.success && d.imageUrl) {
          setForm(prev => ({ ...prev, image: `${getApiUrl()}${d.imageUrl}` }));
        }
      } catch { alert("No se pudo subir la imagen"); }
      finally { setIsUploadingImage(false); }
    };
    input.click();
  };

  const handleSave = async () => {
    if (!form.name.trim()) { alert("El nombre es requerido"); return; }
    if (!form.price || isNaN(parseFloat(form.price))) { alert("Introduce un precio válido"); return; }
    try {
      const priceInCents = Math.round(parseFloat(form.price) * 100);
      const payload = {
        name: form.name, description: form.description,
        price: priceInCents,
        image: form.image || "https://res.cloudinary.com/dkuj3vq57/image/upload/v1/comeya/placeholder-food.jpg",
      };
      if (editingProduct) await apiRequest("PUT", `/api/business/products/${editingProduct.id}`, payload);
      else await apiRequest("POST", "/api/business/products", payload);
      setShowForm(false);
      await loadProducts();
    } catch { alert("Error al guardar producto"); }
  };

  const toggleAvailability = async (productId: string, current: boolean) => {
    try {
      await apiRequest("PUT", `/api/business/products/${productId}/availability`, { isAvailable: !current });
      await loadProducts();
    } catch {}
  };

  const handleDelete = async (productId: string) => {
    if (!window.confirm("¿Eliminar este producto?")) return;
    try { await apiRequest("DELETE", `/api/business/products/${productId}`); await loadProducts(); }
    catch { alert("No se pudo eliminar el producto"); }
  };

  const filtered = products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));
  const available = filtered.filter(p => p.isAvailable === 1 || p.isAvailable === true);
  const unavailable = filtered.filter(p => p.isAvailable !== 1 && p.isAvailable !== true);

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <BusinessSidebar />

      {/* Main */}
      <View style={s.main}>
        {/* Toolbar */}
        <View style={[s.toolbar, { backgroundColor: card, borderBottomColor: border }]}>
          <View style={s.toolbarLeft}>
            <Text style={[s.toolbarTitle, { color: text }]}>Productos</Text>
            {selectedBusiness && (
              <Pressable onPress={() => navigation.navigate("MyBusinesses")} style={[s.bizChip, { backgroundColor: ComeYaColors.primary + "15", borderColor: ComeYaColors.primary + "30" }]}>
                <Text style={[s.bizChipText, { color: ComeYaColors.primary }]} numberOfLines={1}>{selectedBusiness.name}</Text>
                <Feather name="chevron-down" size={12} color={ComeYaColors.primary} />
              </Pressable>
            )}
          </View>
          <View style={s.toolbarRight}>
            <View style={[s.statChip, { backgroundColor: ComeYaColors.success + "15" }]}>
              <Text style={[s.statChipValue, { color: ComeYaColors.success }]}>{available.length}</Text>
              <Text style={[s.statChipLabel, { color: ComeYaColors.success }]}>Disponibles</Text>
            </View>
            <View style={[s.statChip, { backgroundColor: ComeYaColors.error + "15" }]}>
              <Text style={[s.statChipValue, { color: ComeYaColors.error }]}>{unavailable.length}</Text>
              <Text style={[s.statChipLabel, { color: ComeYaColors.error }]}>Agotados</Text>
            </View>
            <View style={[s.statChip, { backgroundColor: border }]}>
              <Text style={[s.statChipValue, { color: text }]}>{products.length}</Text>
              <Text style={[s.statChipLabel, { color: sub }]}>Total</Text>
            </View>
            <Pressable onPress={openAdd} style={[s.addBtn, { backgroundColor: ComeYaColors.primary }]}>
              <Feather name="plus" size={16} color="#fff" />
              <Text style={s.addBtnText}>Nuevo producto</Text>
            </Pressable>
          </View>
        </View>
        {/* Barra de búsqueda */}
        <View style={[s.searchBar, { backgroundColor: bg, borderBottomColor: border }]}>
          <Feather name="search" size={18} color={sub} />
          <TextInput
            style={[s.searchInput, { color: text }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar producto..."
            placeholderTextColor={sub}
          />
          {search ? <Pressable onPress={() => setSearch("")}><Feather name="x" size={16} color={sub} /></Pressable> : null}
        </View>

        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={s.loading}><ActivityIndicator color={ComeYaColors.primary} size="large" /></View>
          ) : filtered.length === 0 ? (
            <View style={s.empty}>
              <Feather name="package" size={48} color={sub} />
              <Text style={[s.emptyText, { color: sub }]}>No hay productos</Text>
              <Pressable onPress={openAdd} style={[s.emptyBtn, { backgroundColor: ComeYaColors.primary }]}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>Agregar primer producto</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {unavailable.length > 0 && (
                <>
                  <View style={s.sectionHeader}>
                    <View style={[s.sectionDot, { backgroundColor: ComeYaColors.error }]} />
                    <Text style={[s.sectionTitle, { color: ComeYaColors.error }]}>Agotados ({unavailable.length})</Text>
                  </View>
                  <View style={s.productsGrid}>
                    {unavailable.map(p => <ProductCard key={p.id} product={p} onEdit={openEdit} onDelete={handleDelete} onToggle={toggleAvailability} card={card} border={border} text={text} sub={sub} />)}
                  </View>
                </>
              )}
              <View style={s.sectionHeader}>
                <View style={[s.sectionDot, { backgroundColor: ComeYaColors.success }]} />
                <Text style={[s.sectionTitle, { color: ComeYaColors.success }]}>Disponibles ({available.length})</Text>
              </View>
              <View style={s.productsGrid}>
                {available.map(p => <ProductCard key={p.id} product={p} onEdit={openEdit} onDelete={handleDelete} onToggle={toggleAvailability} card={card} border={border} text={text} sub={sub} />)}
              </View>
            </>
          )}
        </ScrollView>
      </View>

      {/* Panel de formulario */}
      {showForm && (
        <View style={[s.formPanel, { backgroundColor: card, borderLeftColor: border }]}>
          <View style={s.formHeader}>
            <Text style={[s.formTitle, { color: text }]}>{editingProduct ? "Editar producto" : "Nuevo producto"}</Text>
            <Pressable onPress={() => setShowForm(false)}><Feather name="x" size={22} color={text} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={s.formContent} showsVerticalScrollIndicator={false}>
            {/* Imagen */}
            <Pressable onPress={pickImage} style={[s.imagePicker, { backgroundColor: form.image ? "transparent" : theme.backgroundSecondary, borderColor: border }]}>
              {isUploadingImage ? (
                <View style={s.imagePickerInner}><ActivityIndicator color={ComeYaColors.primary} /><Text style={[s.imagePickerText, { color: sub }]}>Subiendo...</Text></View>
              ) : form.image ? (
                <Image source={{ uri: form.image }} style={s.imagePreview} contentFit="cover" />
              ) : (
                <View style={s.imagePickerInner}>
                  <Feather name="camera" size={28} color={sub} />
                  <Text style={[s.imagePickerText, { color: sub }]}>Subir foto del producto</Text>
                </View>
              )}
            </Pressable>

            {[
              { key: "name", label: "Nombre *", placeholder: "Ej: Bocadillo de jamón" },
              { key: "description", label: "Descripción", placeholder: "Descripción del producto..." },
              { key: "price", label: "Precio (€) *", placeholder: "9.50" },
              { key: "image", label: "URL de imagen (opcional)", placeholder: "https://..." },
            ].map(f => (
              <View key={f.key} style={s.field}>
                <Text style={[s.fieldLabel, { color: sub }]}>{f.label}</Text>
                <TextInput
                  style={[s.input, { backgroundColor: theme.backgroundSecondary, color: text, borderColor: border, minHeight: f.key === "description" ? 80 : 48 }]}
                  value={(form as any)[f.key]}
                  onChangeText={v => setForm(p => ({ ...p, [f.key]: v }))}
                  placeholder={f.placeholder}
                  placeholderTextColor={sub}
                  keyboardType={f.key === "price" ? "decimal-pad" : "default"}
                  multiline={f.key === "description"}
                  textAlignVertical={f.key === "description" ? "top" : "center"}
                />
              </View>
            ))}

            <View style={s.formBtns}>
              <Pressable onPress={() => setShowForm(false)} style={[s.formBtn, { borderColor: border, borderWidth: 1 }]}>
                <Text style={{ color: text }}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={handleSave} style={[s.formBtn, { backgroundColor: ComeYaColors.primary }]}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>Guardar</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function ProductCard({ product, onEdit, onDelete, onToggle, card, border, text, sub }: any) {
  const isAvailable = product.isAvailable === 1 || product.isAvailable === true;
  return (
    <View style={[pc.card, { backgroundColor: card, borderColor: isAvailable ? border : ComeYaColors.error + "40", borderWidth: isAvailable ? 1 : 1.5, opacity: isAvailable ? 1 : 0.7 }]}>
      <Image
        source={product.image ? { uri: product.image } : require("../../assets/images/delivery-hero.png")}
        style={pc.image}
        contentFit="cover"
      />
      <View style={pc.info}>
        <Text style={[pc.name, { color: text }]} numberOfLines={1}>{product.name}</Text>
        <Text style={[pc.desc, { color: sub }]} numberOfLines={2}>{product.description}</Text>
        <Text style={[pc.price, { color: ComeYaColors.primary }]}>€{(product.price / 100).toFixed(2)}</Text>
      </View>
      <View style={pc.actions}>
        <Switch
          value={isAvailable}
          onValueChange={() => onToggle(product.id, isAvailable)}
          trackColor={{ false: ComeYaColors.error, true: ComeYaColors.success }}
          thumbColor="#fff"
        />
        <Pressable onPress={() => onEdit(product)} style={pc.iconBtn}>
          <Feather name="edit-2" size={16} color={ComeYaColors.primary} />
        </Pressable>
        <Pressable onPress={() => onDelete(product.id)} style={pc.iconBtn}>
          <Feather name="trash-2" size={16} color={ComeYaColors.error} />
        </Pressable>
      </View>
    </View>
  );
}

const pc = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, marginBottom: 10 },
  image: { width: 72, height: 72, borderRadius: 10 },
  info: { flex: 1, marginLeft: 14 },
  name: { fontSize: 15, fontWeight: "700", marginBottom: 3 },
  desc: { fontSize: 12, lineHeight: 17, marginBottom: 4 },
  price: { fontSize: 16, fontWeight: "800" },
  actions: { alignItems: "center", gap: 8, marginLeft: 12 },
  iconBtn: { padding: 6 },
});

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "row" },
  main: { flex: 1, flexDirection: "column" },
  toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingVertical: 14, borderBottomWidth: 1 },
  toolbarLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  toolbarTitle: { fontSize: 20, fontWeight: "800" },
  bizChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  bizChipText: { fontSize: 12, fontWeight: "600" },
  toolbarRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  statChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  statChipValue: { fontSize: 15, fontWeight: "800" },
  statChipLabel: { fontSize: 11 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 10, justifyContent: "center" },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1 },
  searchInput: { flex: 1, fontSize: 15 },
  content: { padding: 24, maxWidth: 900 },
  loading: { paddingVertical: 80, alignItems: "center" },
  empty: { alignItems: "center", paddingVertical: 80, gap: 16 },
  emptyText: { fontSize: 16 },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, marginTop: 8 },
  sectionDot: { width: 10, height: 10, borderRadius: 5 },
  sectionTitle: { fontSize: 15, fontWeight: "700" },
  productsGrid: { marginBottom: 20 },
  formPanel: { width: 360, borderLeftWidth: 1, flexDirection: "column" },
  formHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#e0e0e0" },
  formTitle: { fontSize: 18, fontWeight: "700" },
  formContent: { padding: 20 },
  imagePicker: { height: 160, borderRadius: 14, borderWidth: 2, borderStyle: "dashed", overflow: "hidden", marginBottom: 16, justifyContent: "center", alignItems: "center" },
  imagePickerInner: { alignItems: "center", gap: 8 },
  imagePickerText: { fontSize: 13 },
  imagePreview: { width: "100%", height: "100%" },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: "600", marginBottom: 6, textTransform: "uppercase" },
  input: { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  formBtns: { flexDirection: "row", gap: 10, marginTop: 8 },
  formBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
});
