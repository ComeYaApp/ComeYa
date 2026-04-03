import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ComeYaColors, Spacing, BorderRadius } from "../../../constants/theme";
import { apiRequest } from "../../../lib/query-client";

interface Coupon {
  id: string;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minOrderAmount: number | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

interface CouponsTabProps {
  theme: any;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
  onSelectCoupon: (coupon: Coupon) => void;
}

export const CouponsTab: React.FC<CouponsTabProps> = ({ theme, showToast, onSelectCoupon }) => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    code: "",
    discountType: "percentage" as "percentage" | "fixed",
    discountValue: "",
    minOrderAmount: "",
    maxUses: "",
    maxUsesPerUser: "",
    expiresAt: "",
  });


  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      const res = await apiRequest("GET", "/api/admin/coupons");
      const data = await res.json();
      setCoupons(data.coupons || []);
    } catch (error) {
      console.error("Error fetching coupons:", error);
      showToast("Error al cargar cupones", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCoupon = async () => {
    if (!formData.code || !formData.discountValue) {
      showToast("Código y descuento son requeridos", "error");
      return;
    }

    try {
      const res = await apiRequest("POST", "/api/admin/coupons", {
        code: formData.code.toUpperCase(),
        discountType: formData.discountType,
        discountValue: formData.discountType === "percentage" 
          ? parseInt(formData.discountValue)
          : Math.round(parseFloat(formData.discountValue) * 100),
        minOrderAmount: formData.minOrderAmount ? Math.round(parseFloat(formData.minOrderAmount) * 100) : null,
        maxUses: formData.maxUses ? parseInt(formData.maxUses) : null,
        maxUsesPerUser: formData.maxUsesPerUser ? parseInt(formData.maxUsesPerUser) : null,
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : null,
        isActive: true,
      });

      if (res.ok) {
        showToast("Cupón creado exitosamente", "success");
        setShowModal(false);
        setFormData({
          code: "",
          discountType: "percentage",
          discountValue: "",
          minOrderAmount: "",
          maxUses: "",
          maxUsesPerUser: "",
          expiresAt: "",
        });
        fetchCoupons();
      } else {
        showToast("Error al crear cupón", "error");
      }
    } catch (error) {
      showToast("Error al crear cupón", "error");
    }
  };





  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={ComeYaColors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.text }]}>
          Cupones ({coupons.length})
        </Text>
        <Pressable
          onPress={() => setShowModal(true)}
          style={[styles.addButton, { backgroundColor: ComeYaColors.primary }]}
        >
          <Feather name="plus" size={20} color="#FFF" />
          <Text style={styles.addButtonText}>Crear cupón</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {coupons.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.card }]}>
            <Feather name="tag" size={48} color={theme.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No hay cupones creados
            </Text>
          </View>
        ) : (
          coupons.map((coupon) => (
            <Pressable 
              key={coupon.id} 
              style={[styles.card, { backgroundColor: theme.card }]}
              onPress={() => onSelectCoupon(coupon)}
            >
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.couponCode, { color: ComeYaColors.primary }]}>
                    {coupon.code}
                  </Text>
                  <Text style={[styles.couponDiscount, { color: theme.textSecondary }]}>
                    {coupon.discountType === "percentage"
                      ? `${coupon.discountValue}% descuento`
                      : `$${(coupon.discountValue / 100).toFixed(0)} descuento`}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: coupon.isActive
                        ? ComeYaColors.success + "20"
                        : ComeYaColors.error + "20",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      { color: coupon.isActive ? ComeYaColors.success : ComeYaColors.error },
                    ]}
                  >
                    {coupon.isActive ? "Activo" : "Inactivo"}
                  </Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Usos</Text>
                  <Text style={[styles.statValue, { color: theme.text }]}>
                    {coupon.usedCount}/{coupon.maxUses || "∞"}
                  </Text>
                </View>
                {coupon.minOrderAmount ? (
                  <View style={styles.stat}>
                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Mínimo</Text>
                    <Text style={[styles.statValue, { color: theme.text }]}>
                      ${(coupon.minOrderAmount / 100).toFixed(0)}
                    </Text>
                  </View>
                ) : null}
                {coupon.expiresAt ? (
                  <View style={styles.stat}>
                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Expira</Text>
                    <Text style={[styles.statValue, { color: theme.text }]}>
                      {new Date(coupon.expiresAt).toLocaleDateString("es-VE")}
                    </Text>
                  </View>
                ) : null}
              </View>

            </Pressable>
          ))
        )}
      </ScrollView>

      {/* Modal de crear cupón */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Crear cupón</Text>
              <Pressable onPress={() => setShowModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={[styles.label, { color: theme.text }]}>Código *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                value={formData.code}
                onChangeText={(text) => setFormData({ ...formData, code: text.toUpperCase() })}
                placeholder="BIENVENIDA20"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="characters"
              />

              <Text style={[styles.label, { color: theme.text }]}>Tipo de descuento *</Text>
              <View style={styles.radioGroup}>
                <Pressable
                  onPress={() => setFormData({ ...formData, discountType: "percentage" })}
                  style={[styles.radioOption, { borderColor: formData.discountType === "percentage" ? ComeYaColors.primary : theme.border }]}
                >
                  <Feather
                    name={formData.discountType === "percentage" ? "check-circle" : "circle"}
                    size={20}
                    color={formData.discountType === "percentage" ? ComeYaColors.primary : theme.textSecondary}
                  />
                  <Text style={[styles.radioLabel, { color: theme.text }]}>Porcentaje (%)</Text>
                </Pressable>
                <Pressable
                  onPress={() => setFormData({ ...formData, discountType: "fixed" })}
                  style={[styles.radioOption, { borderColor: formData.discountType === "fixed" ? ComeYaColors.primary : theme.border }]}
                >
                  <Feather
                    name={formData.discountType === "fixed" ? "check-circle" : "circle"}
                    size={20}
                    color={formData.discountType === "fixed" ? ComeYaColors.primary : theme.textSecondary}
                  />
                  <Text style={[styles.radioLabel, { color: theme.text }]}>Monto fijo ($)</Text>
                </Pressable>
              </View>

              <Text style={[styles.label, { color: theme.text }]}>
                {formData.discountType === "percentage" ? "Porcentaje de descuento *" : "Monto de descuento * ($)"}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                value={formData.discountValue}
                onChangeText={(text) => setFormData({ ...formData, discountValue: text })}
                placeholder={formData.discountType === "percentage" ? "20" : "50.00"}
                placeholderTextColor={theme.textSecondary}
                keyboardType="decimal-pad"
              />

              <Text style={[styles.label, { color: theme.text }]}>Pedido mínimo ($)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                value={formData.minOrderAmount}
                onChangeText={(text) => setFormData({ ...formData, minOrderAmount: text })}
                placeholder="100.00"
                placeholderTextColor={theme.textSecondary}
                keyboardType="decimal-pad"
              />

              <Text style={[styles.label, { color: theme.text }]}>Usos máximos totales</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                value={formData.maxUses}
                onChangeText={(text) => setFormData({ ...formData, maxUses: text })}
                placeholder="100"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
              />

              <Text style={[styles.label, { color: theme.text }]}>Usos máximos por usuario</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                value={formData.maxUsesPerUser}
                onChangeText={(text) => setFormData({ ...formData, maxUsesPerUser: text })}
                placeholder="1"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
              />

              <Text style={[styles.label, { color: theme.text }]}>Fecha de expiración</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                value={formData.expiresAt}
                onChangeText={(text) => setFormData({ ...formData, expiresAt: text })}
                placeholder="2024-12-31"
                placeholderTextColor={theme.textSecondary}
              />
              <Text style={[styles.hint, { color: theme.textSecondary }]}>Formato: YYYY-MM-DD</Text>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable
                onPress={() => setShowModal(false)}
                style={[styles.modalButton, { backgroundColor: theme.backgroundSecondary }]}
              >
                <Text style={{ color: theme.text }}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleCreateCoupon}
                style={[styles.modalButton, { backgroundColor: ComeYaColors.primary }]}
              >
                <Text style={{ color: "#FFF", fontWeight: "600" }}>Crear</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    gap: 8,
  },
  addButtonText: {
    color: "#FFF",
    fontWeight: "600",
  },
  emptyState: {
    padding: 48,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  emptyText: {
    marginTop: 16,
    fontSize: 14,
  },
  card: {
    padding: 16,
    borderRadius: BorderRadius.lg,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  couponCode: {
    fontSize: 18,
    fontWeight: "bold",
  },
  couponDiscount: {
    fontSize: 14,
    marginTop: 4,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12,
  },
  stat: {
    alignItems: "center",
  },
  statLabel: {
    fontSize: 12,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 500,
    maxHeight: "90%",
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
  },
  modalBody: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    height: 48,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  radioGroup: {
    flexDirection: "row",
    gap: 12,
  },
  radioOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    gap: 8,
  },
  radioLabel: {
    fontSize: 14,
  },
  hint: {
    fontSize: 12,
    marginTop: 4,
  },
  modalFooter: {
    flexDirection: "row",
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  modalButton: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
});
