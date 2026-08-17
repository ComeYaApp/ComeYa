import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ComeYaColors, Spacing, BorderRadius } from "../../../constants/theme";
import { apiRequest } from "@/lib/query-client";

interface Props {
  theme: any;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
}

const BENEFIT_TYPES = [
  {
    key: "free_delivery",
    label: "Envío gratis",
    icon: "truck",
    hint: "Valor: 100 = activo — ✅ Se aplica automáticamente al precio",
  },
  {
    key: "discount",
    label: "Descuento (%)",
    icon: "percent",
    hint: "Valor: número (ej: 10 = 10%) — ✅ Se aplica automáticamente al precio",
  },
  {
    key: "priority_support",
    label: "Soporte prioritario",
    icon: "headphones",
    hint: "Valor: 1 = activo — ℹ️ Solo informativo, se muestra al cliente",
  },
  {
    key: "exclusive_deals",
    label: "Ofertas exclusivas",
    icon: "tag",
    hint: "Valor: 1 = activo — ℹ️ Solo informativo",
  },
  {
    key: "no_minimum",
    label: "Sin mínimo de pedido",
    icon: "minus-circle",
    hint: "Valor: 1 = activo — ℹ️ Solo informativo",
  },
  {
    key: "analytics",
    label: "Analytics avanzados",
    icon: "bar-chart-2",
    hint: "Valor: 1 = activo — ℹ️ Solo informativo",
  },
  {
    key: "custom",
    label: "Personalizado",
    icon: "star",
    hint: "Valor numérico libre — ℹ️ Solo informativo",
  },
];

export const SubscriptionPlansTab: React.FC<Props> = ({ theme, showToast }) => {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [addingBenefit, setAddingBenefit] = useState<string | null>(null); // planKey
  const [saving, setSaving] = useState(false);

  // Form states
  const [planForm, setPlanForm] = useState({
    name: "",
    description: "",
    price: "",
    color: "",
  });
  const [benefitForm, setBenefitForm] = useState({
    benefitType: "free_delivery",
    benefitValue: "100",
    description: "",
  });

  const load = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/admin/subscription-plans");
      const data = await res.json();
      if (data.success) setPlans(data.plans);
    } catch {
      showToast("Error al cargar planes", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, []);

  const openEditPlan = (plan: any) => {
    setPlanForm({
      name: plan.name,
      description: plan.description || "",
      price: String(plan.price / 100),
      color: plan.color || "#DC2626",
    });
    setEditingPlan(plan);
  };

  const savePlan = async () => {
    if (!editingPlan) return;
    setSaving(true);
    try {
      const res = await apiRequest(
        "PUT",
        `/api/admin/subscription-plans/${editingPlan.planKey}`,
        {
          name: planForm.name,
          description: planForm.description,
          price: Math.round(parseFloat(planForm.price) * 100),
          color: planForm.color,
          isActive: editingPlan.isActive,
        },
      );
      const data = await res.json();
      if (data.success) {
        showToast("Plan actualizado", "success");
        setEditingPlan(null);
        load();
      } else {
        showToast(data.error || "Error", "error");
      }
    } catch {
      showToast("Error de conexión", "error");
    } finally {
      setSaving(false);
    }
  };

  const addBenefit = async () => {
    if (!addingBenefit) return;
    setSaving(true);
    try {
      const res = await apiRequest("POST", "/api/admin/subscription-benefits", {
        plan: addingBenefit,
        benefitType: benefitForm.benefitType,
        benefitValue: benefitForm.benefitValue,
        description: benefitForm.description,
      });
      const data = await res.json();
      if (data.success) {
        showToast("Beneficio añadido", "success");
        setAddingBenefit(null);
        setBenefitForm({
          benefitType: "free_delivery",
          benefitValue: "true",
          description: "",
        });
        load();
      } else {
        showToast(data.error || "Error", "error");
      }
    } catch {
      showToast("Error de conexión", "error");
    } finally {
      setSaving(false);
    }
  };

  const deleteBenefit = async (id: string) => {
    try {
      const res = await apiRequest(
        "DELETE",
        `/api/admin/subscription-benefits/${id}`,
      );
      const data = await res.json();
      if (data.success) {
        showToast("Beneficio eliminado", "success");
        load();
      } else showToast(data.error || "Error", "error");
    } catch {
      showToast("Error de conexión", "error");
    }
  };

  const s = st(theme);

  if (loading)
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={ComeYaColors.primary} />
      </View>
    );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          tintColor={ComeYaColors.primary}
        />
      }
    >
      <Text style={[s.pageTitle, { color: theme.text }]}>
        Planes de Suscripción
      </Text>
      <Text style={[s.pageSub, { color: theme.textSecondary }]}>
        Edita precios, nombres y beneficios de cada plan. Los cambios se aplican
        inmediatamente.
      </Text>

      {plans
        .filter((p) => p.planKey !== "free")
        .map((plan) => (
          <View
            key={plan.planKey}
            style={[
              s.planCard,
              { backgroundColor: theme.card, borderColor: plan.color + "60" },
            ]}
          >
            {/* Header del plan */}
            <View
              style={[s.planHeader, { backgroundColor: plan.color + "15" }]}
            >
              <View
                style={[s.planIconWrap, { backgroundColor: plan.color + "25" }]}
              >
                <Feather
                  name={plan.icon || "star"}
                  size={22}
                  color={plan.color}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[s.planName, { color: theme.text }]}>
                  {plan.name}
                </Text>
                <Text style={[s.planPrice, { color: plan.color }]}>
                  {(plan.price / 100).toFixed(2)} €/mes
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => openEditPlan(plan)}
                style={[s.editBtn, { backgroundColor: plan.color }]}
              >
                <Feather name="edit-2" size={14} color="#fff" />
                <Text style={s.editBtnText}>Editar</Text>
              </TouchableOpacity>
            </View>

            {/* Beneficios */}
            <View style={s.benefitsSection}>
              <Text style={[s.benefitsTitle, { color: theme.textSecondary }]}>
                BENEFICIOS ACTIVOS
              </Text>
              {plan.benefits?.length === 0 && (
                <Text
                  style={{
                    color: theme.textSecondary,
                    fontSize: 13,
                    marginBottom: 8,
                  }}
                >
                  Sin beneficios configurados
                </Text>
              )}
              {plan.benefits?.map((b: any) => {
                const typeInfo =
                  BENEFIT_TYPES.find((t) => t.key === b.type) ||
                  BENEFIT_TYPES[BENEFIT_TYPES.length - 1];
                return (
                  <View
                    key={b.id}
                    style={[s.benefitRow, { borderBottomColor: theme.border }]}
                  >
                    <View
                      style={[
                        s.benefitIcon,
                        { backgroundColor: ComeYaColors.success + "20" },
                      ]}
                    >
                      <Feather
                        name={typeInfo.icon as any}
                        size={14}
                        color={ComeYaColors.success}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[s.benefitLabel, { color: theme.text }]}>
                        {typeInfo.label}
                      </Text>
                      <Text
                        style={[s.benefitDesc, { color: theme.textSecondary }]}
                      >
                        {b.description ||
                          (b.type === "discount_percentage"
                            ? `${b.value}% descuento`
                            : b.value)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() =>
                        Alert.alert("Eliminar", "¿Eliminar este beneficio?", [
                          { text: "Cancelar", style: "cancel" },
                          {
                            text: "Eliminar",
                            style: "destructive",
                            onPress: () => deleteBenefit(b.id),
                          },
                        ])
                      }
                      style={s.deleteBtn}
                    >
                      <Feather name="trash-2" size={15} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                );
              })}

              <TouchableOpacity
                onPress={() => {
                  setAddingBenefit(plan.planKey);
                  setBenefitForm({
                    benefitType: "free_delivery",
                    benefitValue: "true",
                    description: "",
                  });
                }}
                style={[s.addBenefitBtn, { borderColor: plan.color }]}
              >
                <Feather name="plus" size={16} color={plan.color} />
                <Text style={[s.addBenefitText, { color: plan.color }]}>
                  Añadir beneficio
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

      {/* Modal editar plan */}
      <Modal
        visible={!!editingPlan}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingPlan(null)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { backgroundColor: theme.card }]}>
            <Text style={[s.modalTitle, { color: theme.text }]}>
              Editar Plan {editingPlan?.name}
            </Text>

            <Text style={[s.inputLabel, { color: theme.textSecondary }]}>
              Nombre del plan
            </Text>
            <TextInput
              style={[
                s.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundSecondary,
                },
              ]}
              value={planForm.name}
              onChangeText={(v) => setPlanForm((f) => ({ ...f, name: v }))}
            />

            <Text style={[s.inputLabel, { color: theme.textSecondary }]}>
              Descripción
            </Text>
            <TextInput
              style={[
                s.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundSecondary,
                },
              ]}
              value={planForm.description}
              onChangeText={(v) =>
                setPlanForm((f) => ({ ...f, description: v }))
              }
            />

            <Text style={[s.inputLabel, { color: theme.textSecondary }]}>
              Precio mensual (€)
            </Text>
            <TextInput
              style={[
                s.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundSecondary,
                },
              ]}
              value={planForm.price}
              onChangeText={(v) => setPlanForm((f) => ({ ...f, price: v }))}
              keyboardType="decimal-pad"
              placeholder="15.00"
            />

            <Text style={[s.inputLabel, { color: theme.textSecondary }]}>
              Color (hex)
            </Text>
            <TextInput
              style={[
                s.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundSecondary,
                },
              ]}
              value={planForm.color}
              onChangeText={(v) => setPlanForm((f) => ({ ...f, color: v }))}
              placeholder="#F59E0B"
            />

            <View style={s.modalBtns}>
              <TouchableOpacity
                onPress={() => setEditingPlan(null)}
                style={[s.modalBtn, { backgroundColor: theme.border }]}
              >
                <Text style={{ color: theme.text, fontWeight: "600" }}>
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={savePlan}
                disabled={saving}
                style={[s.modalBtn, { backgroundColor: ComeYaColors.primary }]}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "700" }}>
                    Guardar
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal añadir beneficio */}
      <Modal
        visible={!!addingBenefit}
        transparent
        animationType="slide"
        onRequestClose={() => setAddingBenefit(null)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { backgroundColor: theme.card }]}>
            <Text style={[s.modalTitle, { color: theme.text }]}>
              Añadir beneficio — {addingBenefit}
            </Text>

            <Text style={[s.inputLabel, { color: theme.textSecondary }]}>
              Tipo de beneficio
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 4 }}
            >
              {BENEFIT_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  onPress={() =>
                    setBenefitForm((f) => ({ ...f, benefitType: t.key }))
                  }
                  style={[
                    s.typeChip,
                    {
                      backgroundColor:
                        benefitForm.benefitType === t.key
                          ? ComeYaColors.primary
                          : theme.backgroundSecondary,
                      borderColor:
                        benefitForm.benefitType === t.key
                          ? ComeYaColors.primary
                          : theme.border,
                    },
                  ]}
                >
                  <Feather
                    name={t.icon as any}
                    size={13}
                    color={
                      benefitForm.benefitType === t.key
                        ? "#fff"
                        : theme.textSecondary
                    }
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      marginLeft: 4,
                      color:
                        benefitForm.benefitType === t.key ? "#fff" : theme.text,
                    }}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {benefitForm.benefitType && (
              <Text
                style={{
                  fontSize: 11,
                  color: BENEFIT_TYPES.find(
                    (t) => t.key === benefitForm.benefitType,
                  )?.hint?.includes("✅")
                    ? "#10B981"
                    : "#6B7280",
                  marginBottom: 12,
                }}
              >
                {
                  BENEFIT_TYPES.find((t) => t.key === benefitForm.benefitType)
                    ?.hint
                }
              </Text>
            )}

            <Text style={[s.inputLabel, { color: theme.textSecondary }]}>
              Valor{" "}
              {benefitForm.benefitType === "discount"
                ? "(número, ej: 10 = 10%)"
                : "(100 = activo, 0 = inactivo)"}
            </Text>
            <TextInput
              style={[
                s.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundSecondary,
                },
              ]}
              value={benefitForm.benefitValue}
              onChangeText={(v) =>
                setBenefitForm((f) => ({ ...f, benefitValue: v }))
              }
              placeholder={
                benefitForm.benefitType === "discount" ? "10" : "100"
              }
            />

            <Text style={[s.inputLabel, { color: theme.textSecondary }]}>
              Descripción visible al cliente
            </Text>
            <TextInput
              style={[
                s.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundSecondary,
                },
              ]}
              value={benefitForm.description}
              onChangeText={(v) =>
                setBenefitForm((f) => ({ ...f, description: v }))
              }
              placeholder="Ej: Envío gratis en todos tus pedidos"
            />

            <View style={s.modalBtns}>
              <TouchableOpacity
                onPress={() => setAddingBenefit(null)}
                style={[s.modalBtn, { backgroundColor: theme.border }]}
              >
                <Text style={{ color: theme.text, fontWeight: "600" }}>
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={addBenefit}
                disabled={saving}
                style={[s.modalBtn, { backgroundColor: ComeYaColors.primary }]}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "700" }}>
                    Añadir
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const st = (theme: any) =>
  StyleSheet.create({
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },
    pageTitle: { fontSize: 20, fontWeight: "800", marginBottom: 4 },
    pageSub: { fontSize: 13, marginBottom: 20, lineHeight: 18 },
    planCard: {
      borderRadius: 16,
      borderWidth: 2,
      marginBottom: 20,
      overflow: "hidden",
    },
    planHeader: { flexDirection: "row", alignItems: "center", padding: 16 },
    planIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: "center",
      alignItems: "center",
    },
    planName: { fontSize: 17, fontWeight: "700" },
    planPrice: { fontSize: 14, fontWeight: "600", marginTop: 2 },
    editBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 8,
    },
    editBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
    benefitsSection: { padding: 16 },
    benefitsTitle: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 1,
      marginBottom: 10,
    },
    benefitRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
    },
    benefitIcon: {
      width: 30,
      height: 30,
      borderRadius: 15,
      justifyContent: "center",
      alignItems: "center",
    },
    benefitLabel: { fontSize: 13, fontWeight: "600" },
    benefitDesc: { fontSize: 12, marginTop: 1 },
    deleteBtn: { padding: 6 },
    addBenefitBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 8,
      borderWidth: 1.5,
      borderStyle: "dashed",
      alignSelf: "flex-start",
    },
    addBenefitText: { fontSize: 13, fontWeight: "600" },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    modalSheet: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: 40,
    },
    modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
    inputLabel: {
      fontSize: 12,
      fontWeight: "600",
      marginBottom: 4,
      marginTop: 8,
    },
    input: {
      borderWidth: 1.5,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      marginBottom: 4,
    },
    modalBtns: { flexDirection: "row", gap: 10, marginTop: 20 },
    modalBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    typeChip: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 20,
      borderWidth: 1,
      marginRight: 8,
    },
  });
