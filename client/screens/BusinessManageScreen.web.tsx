import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Text, Switch, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { ComeYaColors, Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useResponsive } from "@/hooks/useResponsive";
import { MobileSidebarWrapper } from "@/components/MobileSidebarWrapper";

interface Product { id: string; name: string; price: number; image: string; category: string; isAvailable: boolean; }
interface Business { id: string; name: string; isOpen: boolean; products: Product[]; }

export default function BusinessManageScreen() {
  const navigation = useNavigation<any>();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isMobile } = useResponsive();
  const [activeTab, setActiveTab] = useState<"products" | "settings">("products");

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";

  const { data: business, isLoading, refetch } = useQuery<Business>({
    queryKey: ["/api/business", user?.id, "details"],
    enabled: !!user?.id,
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ productId, isAvailable }: { productId: string; isAvailable: boolean }) => {
      await apiRequest("PUT", `/api/admin/products/${productId}`, { isAvailable });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/business", user?.id] }),
  });

  const toggleBusinessMutation = useMutation({
    mutationFn: async ({ businessId, isOpen }: { businessId: string; isOpen: boolean }) => {
      await apiRequest("PUT", `/api/admin/businesses/${businessId}`, { isOpen });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/business", user?.id] }),
  });

  const products = business?.products || [];
  const available = products.filter(p => p.isAvailable);
  const unavailable = products.filter(p => !p.isAvailable);

  const settingItems = [
    { icon: "clock", label: "Horarios de apertura", sub: "Configura tus turnos", onPress: () => navigation.navigate("BusinessHours") },
    { icon: "tag", label: "Categorías", sub: "Organiza tu menú", onPress: () => navigation.navigate("BusinessCategories") },
    { icon: "bar-chart-2", label: "Estadísticas", sub: "Ventas y métricas", onPress: () => navigation.navigate("BusinessStats") },
    { icon: "credit-card", label: "Cuentas de cobro", sub: "Bizum, IBAN, PayPal", onPress: () => navigation.navigate("PaymentWalletSetup") },
  ];

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <MobileSidebarWrapper title="Mi Negocio" sidebarStyle={[s.sidebar, { backgroundColor: card, borderRightColor: border }]}>
        <Text style={[s.sideTitle, { color: text }]}>{business?.name || "Mi Negocio"}</Text>

        {/* Estado abierto/cerrado */}
        <View style={[s.statusCard, { backgroundColor: (business?.isOpen ? ComeYaColors.success : ComeYaColors.error) + "15", borderColor: (business?.isOpen ? ComeYaColors.success : ComeYaColors.error) + "40" }]}>
          <View style={[s.statusDot, { backgroundColor: business?.isOpen ? ComeYaColors.success : ComeYaColors.error }]} />
          <Text style={[s.statusText, { color: business?.isOpen ? ComeYaColors.success : ComeYaColors.error }]}>
            {business?.isOpen ? "Abierto" : "Cerrado"}
          </Text>
          <Switch
            value={business?.isOpen ?? false}
            onValueChange={v => business && toggleBusinessMutation.mutate({ businessId: business.id, isOpen: v })}
            trackColor={{ false: ComeYaColors.error, true: ComeYaColors.success }}
            thumbColor="#fff"
          />
        </View>

        {/* Stats rápidas */}}
        <View style={[s.quickStats, { borderColor: border }]}>
          <View style={s.quickStat}>
            <Text style={[s.quickStatValue, { color: ComeYaColors.success }]}>{available.length}</Text>
            <Text style={[s.quickStatLabel, { color: sub }]}>Disponibles</Text>
          </View>
          <View style={[s.quickStatDivider, { backgroundColor: border }]} />
          <View style={s.quickStat}>
            <Text style={[s.quickStatValue, { color: ComeYaColors.error }]}>{unavailable.length}</Text>
            <Text style={[s.quickStatLabel, { color: sub }]}>Agotados</Text>
          </View>
          <View style={[s.quickStatDivider, { backgroundColor: border }]} />
          <View style={s.quickStat}>
            <Text style={[s.quickStatValue, { color: text }]}>{products.length}</Text>
            <Text style={[s.quickStatLabel, { color: sub }]}>Total</Text>
          </View>
        </View>

        {/* Tabs */}
        {[
          { id: "products", label: "Productos", icon: "package" },
          { id: "settings", label: "Ajustes", icon: "settings" },
        ].map(tab => (
          <Pressable
            key={tab.id}
            onPress={() => setActiveTab(tab.id as any)}
            style={[s.tabBtn, { backgroundColor: activeTab === tab.id ? ComeYaColors.primary + "15" : "transparent", borderColor: activeTab === tab.id ? ComeYaColors.primary : border }]}
          >
            <Feather name={tab.icon as any} size={18} color={activeTab === tab.id ? ComeYaColors.primary : sub} />
            <Text style={[s.tabBtnText, { color: activeTab === tab.id ? ComeYaColors.primary : text }]}>{tab.label}</Text>
          </Pressable>
        ))}

        <Pressable onPress={() => navigation.goBack()} style={[s.backBtn, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="arrow-left" size={16} color={text} />
          <Text style={[s.backBtnText, { color: text }]}>Volver</Text>
        </Pressable>
      </MobileSidebarWrapper>

      {/* Main */}
      <ScrollView style={s.main} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={s.loading}><ActivityIndicator color={ComeYaColors.primary} size="large" /></View>
        ) : activeTab === "products" ? (
          <>
            {unavailable.length > 0 && (
              <>
                <View style={s.sectionHeader}>
                  <Feather name="x-circle" size={16} color={ComeYaColors.error} />
                  <Text style={[s.sectionTitle, { color: ComeYaColors.error }]}>Agotados ({unavailable.length})</Text>
                </View>
                {unavailable.map(p => (
                  <ProductRow key={p.id} product={p} onToggle={(id, v) => updateProductMutation.mutate({ productId: id, isAvailable: v })} card={card} border={border} text={text} sub={sub} />
                ))}
              </>
            )}
            <View style={s.sectionHeader}>
              <Feather name="check-circle" size={16} color={ComeYaColors.success} />
              <Text style={[s.sectionTitle, { color: ComeYaColors.success }]}>Disponibles ({available.length})</Text>
            </View>
            {available.map(p => (
              <ProductRow key={p.id} product={p} onToggle={(id, v) => updateProductMutation.mutate({ productId: id, isAvailable: v })} card={card} border={border} text={text} sub={sub} />
            ))}
            {products.length === 0 && (
              <View style={[s.emptyCard, { backgroundColor: card, borderColor: border }]}>
                <Feather name="package" size={40} color={sub} />
                <Text style={[s.emptyText, { color: sub }]}>No hay productos</Text>
              </View>
            )}
          </>
        ) : (
          <>
            <Text style={[s.mainTitle, { color: text }]}>Configuración</Text>
            {settingItems.map((item, i) => (
              <Pressable key={i} onPress={item.onPress} style={[s.settingRow, { backgroundColor: card, borderColor: border }]}>
                <View style={[s.settingIcon, { backgroundColor: ComeYaColors.primary + "15" }]}>
                  <Feather name={item.icon as any} size={20} color={ComeYaColors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={[s.settingLabel, { color: text }]}>{item.label}</Text>
                  <Text style={[s.settingSub, { color: sub }]}>{item.sub}</Text>
                </View>
                <Feather name="chevron-right" size={18} color={sub} />
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function ProductRow({ product, onToggle, card, border, text, sub }: any) {
  return (
    <View style={[s.productRow, { backgroundColor: card, borderColor: border }]}>
      <Image source={{ uri: product.image }} style={s.productImg} contentFit="cover" />
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={[s.productName, { color: text }]} numberOfLines={1}>{product.name}</Text>
        <Text style={[s.productPrice, { color: sub }]}>€{(product.price / 100).toFixed(2)}</Text>
      </View>
      <Text style={[s.productStatus, { color: product.isAvailable ? ComeYaColors.success : ComeYaColors.error }]}>
        {product.isAvailable ? "Disponible" : "Agotado"}
      </Text>
      <Switch
        value={product.isAvailable}
        onValueChange={v => onToggle(product.id, v)}
        trackColor={{ false: ComeYaColors.error, true: ComeYaColors.success }}
        thumbColor="#fff"
        style={{ marginLeft: 10 }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "row" },
  sidebar: { width: 280, minWidth: 280, maxWidth: 280, padding: 24, borderRightWidth: 1, paddingTop: 40 },
  sideTitle: { fontSize: 20, fontWeight: "800", marginBottom: 16, textAlign: "center" },
  statusCard: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { flex: 1, fontSize: 14, fontWeight: "700" },
  quickStats: { flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 14, marginBottom: 16 },
  quickStat: { flex: 1, alignItems: "center" },
  quickStatValue: { fontSize: 22, fontWeight: "900" },
  quickStatLabel: { fontSize: 11, marginTop: 2 },
  quickStatDivider: { width: 1 },
  tabBtn: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5, marginBottom: 8 },
  tabBtnText: { fontSize: 14, fontWeight: "600" },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, marginTop: 8, justifyContent: "center" },
  backBtnText: { fontSize: 14, fontWeight: "600" },
  main: { flex: 1 },
  content: { padding: 32, maxWidth: 800 },
  loading: { paddingVertical: 80, alignItems: "center" },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, marginTop: 8 },
  sectionTitle: { fontSize: 15, fontWeight: "700" },
  productRow: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  productImg: { width: 52, height: 52, borderRadius: 8 },
  productName: { fontSize: 14, fontWeight: "600" },
  productPrice: { fontSize: 13, marginTop: 2 },
  productStatus: { fontSize: 12, fontWeight: "700", marginRight: 4 },
  emptyCard: { padding: 40, borderRadius: 16, borderWidth: 1, alignItems: "center", gap: 12 },
  emptyText: { fontSize: 15 },
  mainTitle: { fontSize: 22, fontWeight: "800", marginBottom: 20 },
  settingRow: { flexDirection: "row", alignItems: "center", padding: 18, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  settingIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  settingLabel: { fontSize: 15, fontWeight: "700" },
  settingSub: { fontSize: 12, marginTop: 2 },
});
