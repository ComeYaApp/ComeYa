import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { ComeYaColors, Spacing, BorderRadius } from "../../../constants/theme";
import { Business } from "../types/admin.types";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";

interface BusinessesTabProps {
  businesses: Business[];
  onBusinessPress: (business: Business) => void;
  onRefresh?: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  restaurant: "Restaurante",
  market: "Mercado",
  grocery: "Supermercado",
  pharmacy: "Farmacia",
  other: "Otro",
};

const VERIFICATION_LABELS: Record<string, string> = {
  pending: "Pendiente",
  verified: "Verificado",
  rejected: "Rechazado",
};

export const BusinessesTab: React.FC<BusinessesTabProps> = ({
  businesses,
  onBusinessPress,
  onRefresh,
}) => {
  const { theme } = useTheme();
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(
    null,
  );
  const [modalVisible, setModalVisible] = useState(false);
  const [customCommission, setCustomCommission] = useState("");
  const [saving, setSaving] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const pendingBusinesses = businesses.filter(
    (b) => b.verificationStatus === "pending",
  );

  const imageOf = (b: Business) => (b as any).imageUrl || b.image || "";

  const handleBusinessPress = (business: Business) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedBusiness(business);
    setCustomCommission(
      business.customCommission?.toString() || "",
    );
    setModalVisible(true);
  };

  const handleVerification = async (
    business: Business,
    action: "verified" | "rejected",
  ) => {
    if (!business.ownerId) {
      Alert.alert(
        "Error",
        "Este negocio no tiene dueño asociado; no se puede verificar.",
      );
      return;
    }
    setVerifyingId(business.id);
    try {
      await apiRequest("PUT", "/api/business/verification-status", {
        userId: business.ownerId,
        verificationStatus: action,
      });
      Alert.alert(
        "Éxito",
        action === "verified"
          ? `Negocio "${business.name}" verificado. El dueño fue notificado.`
          : `Negocio "${business.name}" rechazado. El dueño fue notificado.`,
      );
      onRefresh?.();
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.message || "No se pudo actualizar la verificación",
      );
    } finally {
      setVerifyingId(null);
    }
  };

  const handleSaveBusiness = async () => {
    if (!selectedBusiness) return;
    const commissionValue =
      customCommission.trim() === "" ? null : parseFloat(customCommission);

    if (
      commissionValue !== null &&
      (isNaN(commissionValue) || commissionValue < 0 || commissionValue > 100)
    ) {
      Alert.alert(
        "Error",
        "La comisión debe ser un número entre 0 y 100, o déjalo vacío para usar la comisión global.",
      );
      return;
    }

    setSaving(true);
    try {
      const res = await apiRequest(
        "PUT",
        `/api/admin/businesses/${selectedBusiness.id}`,
        {
          name: selectedBusiness.name,
          address: selectedBusiness.address,
          phone: selectedBusiness.phone,
          type: selectedBusiness.type,
          isActive: selectedBusiness.isActive,
          customCommission: commissionValue,
        },
      );
      const data = await res.json();
      if (data.success) {
        Alert.alert("Éxito", "Negocio actualizado correctamente");
        setModalVisible(false);
        onRefresh?.();
      } else {
        Alert.alert("Error", data.error ?? "No se pudo guardar el negocio");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "No se pudo actualizar el negocio");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof Business, value: any) => {
    setSelectedBusiness((prev) =>
      prev ? { ...prev, [field]: value } : prev,
    );
  };

  return (
    <>
      <ScrollView style={styles.container}>
        {pendingBusinesses.length > 0 && (
          <View style={styles.pendingSection}>
            <View style={styles.pendingHeader}>
              <Feather
                name="clock"
                size={16}
                color={ComeYaColors.warning || "#F59E0B"}
              />
              <Text style={[styles.pendingTitle, { color: theme.text }]}>
                Pendientes de aprobación ({pendingBusinesses.length})
              </Text>
            </View>
            {pendingBusinesses.map((business) => (
              <View
                key={business.id}
                style={[styles.pendingCard, { backgroundColor: theme.card }]}
              >
                <Text style={[styles.businessName, { color: theme.text }]}>
                  {business.name}
                </Text>
                <Text
                  style={[styles.businessAddress, { color: theme.textSecondary }]}
                >
                  {business.address || "Sin dirección"} ·{" "}
                  {business.phone || "Sin teléfono"}
                </Text>
                <View style={styles.verifyButtonRow}>
                  <TouchableOpacity
                    style={[
                      styles.button,
                      styles.saveButton,
                      styles.verifyButton,
                      { backgroundColor: ComeYaColors.success },
                    ]}
                    onPress={() => handleVerification(business, "verified")}
                    disabled={verifyingId === business.id}
                  >
                    <Feather name="check" size={16} color="#fff" />
                    <Text style={[styles.buttonText, { color: "#fff" }]}>
                      {verifyingId === business.id ? "..." : "Aprobar"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.button,
                      styles.cancelButton,
                      styles.verifyButton,
                      { borderColor: ComeYaColors.error },
                    ]}
                    onPress={() => handleVerification(business, "rejected")}
                    disabled={verifyingId === business.id}
                  >
                    <Feather name="x" size={16} color={ComeYaColors.error} />
                    <Text
                      style={[styles.buttonText, { color: ComeYaColors.error }]}
                    >
                      {verifyingId === business.id ? "..." : "Rechazar"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {businesses.map((business) => (
          <TouchableOpacity
            key={business.id}
            style={[styles.card, { backgroundColor: theme.card }]}
            onPress={() => handleBusinessPress(business)}
          >
            <View style={styles.cardRow}>
              {imageOf(business) ? (
                <Image
                  source={{ uri: imageOf(business) }}
                  style={styles.cardImage}
                  contentFit="cover"
                  transition={150}
                />
              ) : (
                <View
                  style={[
                    styles.cardImage,
                    {
                      backgroundColor: theme.backgroundSecondary,
                      justifyContent: "center",
                      alignItems: "center",
                    },
                  ]}
                >
                  <Feather
                    name="briefcase"
                    size={22}
                    color={theme.textSecondary}
                  />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={styles.businessHeader}>
                  <Text
                    style={[styles.businessName, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {business.name}
                  </Text>
                </View>
                <Text
                  style={[styles.businessType, { color: theme.textSecondary }]}
                >
                  {TYPE_LABELS[business.type] || business.type}
                  {business.rating ? ` · ★ ${(business.rating / 10).toFixed(1)}` : ""}
                </Text>
                <Text
                  style={[styles.businessAddress, { color: theme.textSecondary }]}
                  numberOfLines={1}
                >
                  {business.address || "Sin dirección"}
                </Text>
                <Text
                  style={[styles.businessPhone, { color: theme.textSecondary }]}
                >
                  {business.phone || "Sin teléfono"}
                </Text>
              </View>
            </View>
            <View style={styles.badgeRow}>
              {business.verificationStatus &&
                business.verificationStatus !== "verified" && (
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          business.verificationStatus === "pending"
                            ? "#F59E0B"
                            : ComeYaColors.error,
                        marginRight: 6,
                      },
                    ]}
                  >
                    <Text style={styles.statusText}>
                      {VERIFICATION_LABELS[business.verificationStatus] ||
                        business.verificationStatus}
                    </Text>
                  </View>
                )}
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: business.isActive
                      ? ComeYaColors.success
                      : ComeYaColors.error,
                  },
                ]}
              >
                <Text style={styles.statusText}>
                  {business.isActive ? "Activo" : "Inactivo"}
                </Text>
              </View>
              <View style={styles.commissionRow}>
                <Feather
                  name="percent"
                  size={14}
                  color={ComeYaColors.primary}
                />
                <Text
                  style={[styles.commissionText, { color: theme.textSecondary }]}
                >
                  {business.customCommission !== null &&
                  business.customCommission !== undefined
                    ? `Comisión ${business.customCommission}%`
                    : "Comisión global"}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View
              style={[styles.modalHeader, { borderBottomColor: theme.border }]}
            >
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Detalles del negocio
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            {selectedBusiness && (
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={{ padding: Spacing.lg }}
                showsVerticalScrollIndicator={false}
              >
                {/* Foto + badges */}
                <View style={{ alignItems: "center", marginBottom: Spacing.lg }}>
                  {imageOf(selectedBusiness) ? (
                    <Image
                      source={{ uri: imageOf(selectedBusiness) }}
                      style={styles.modalImage}
                      contentFit="cover"
                      transition={150}
                    />
                  ) : (
                    <View
                      style={[
                        styles.modalImage,
                        {
                          backgroundColor: ComeYaColors.primary + "20",
                          justifyContent: "center",
                          alignItems: "center",
                        },
                      ]}
                    >
                      <Feather
                        name="briefcase"
                        size={40}
                        color={ComeYaColors.primary}
                      />
                    </View>
                  )}
                  <View style={styles.badgeRow}>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: selectedBusiness.isActive
                            ? ComeYaColors.success
                            : ComeYaColors.error,
                        },
                      ]}
                    >
                      <Text style={styles.statusText}>
                        {selectedBusiness.isActive ? "Activo" : "Inactivo"}
                      </Text>
                    </View>
                    {selectedBusiness.verificationStatus && (
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor:
                              selectedBusiness.verificationStatus === "verified"
                                ? ComeYaColors.primary
                                : selectedBusiness.verificationStatus ===
                                    "pending"
                                  ? "#F59E0B"
                                  : ComeYaColors.error,
                          },
                        ]}
                      >
                        <Text style={styles.statusText}>
                          {VERIFICATION_LABELS[
                            selectedBusiness.verificationStatus
                          ] || selectedBusiness.verificationStatus}
                        </Text>
                      </View>
                    )}
                    {selectedBusiness.isFeatured && (
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: "#8B5CF6" },
                        ]}
                      >
                        <Text style={styles.statusText}>⭐ Destacado</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Información del negocio */}
                <View
                  style={[
                    styles.infoBox,
                    { backgroundColor: theme.backgroundSecondary },
                  ]}
                >
                  <InfoRow
                    icon="user"
                    label="Dueño"
                    value={
                      (selectedBusiness as any).ownerName ||
                      (selectedBusiness.ownerId
                        ? "ID " + selectedBusiness.ownerId.slice(0, 8)
                        : "Sin dueño")
                    }
                    theme={theme}
                  />
                  <InfoRow
                    icon="calendar"
                    label="Creado"
                    value={
                      selectedBusiness.createdAt
                        ? new Date(
                            selectedBusiness.createdAt,
                          ).toLocaleDateString("es-ES")
                        : "—"
                    }
                    theme={theme}
                  />
                  <InfoRow
                    icon="star"
                    label="Rating"
                    value={
                      selectedBusiness.rating
                        ? `${(selectedBusiness.rating / 10).toFixed(1)} ★`
                        : "Sin valoraciones"
                    }
                    theme={theme}
                  />
                  <InfoRow
                    icon="truck"
                    label="Envío"
                    value={
                      selectedBusiness.deliveryFee
                        ? `${(selectedBusiness.deliveryFee / 100).toFixed(2)} €`
                        : "Gratis"
                    }
                    theme={theme}
                  />
                  <InfoRow
                    icon="shopping-cart"
                    label="Pedido mínimo"
                    value={
                      selectedBusiness.minOrder
                        ? `${(selectedBusiness.minOrder / 100).toFixed(2)} €`
                        : "Sin mínimo"
                    }
                    theme={theme}
                  />
                </View>

                {/* Nombre */}
                <Text style={[styles.label, { color: theme.text }]}>Nombre</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.backgroundSecondary,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  value={selectedBusiness.name}
                  onChangeText={(text) => updateField("name", text)}
                  placeholder="Nombre del negocio"
                  placeholderTextColor={theme.textSecondary}
                />

                {/* Dirección */}
                <Text style={[styles.label, { color: theme.text }]}>
                  Dirección
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.backgroundSecondary,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  value={selectedBusiness.address || ""}
                  onChangeText={(text) => updateField("address", text)}
                  placeholder="Dirección"
                  placeholderTextColor={theme.textSecondary}
                />

                {/* Teléfono */}
                <Text style={[styles.label, { color: theme.text }]}>
                  Teléfono
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.backgroundSecondary,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  value={selectedBusiness.phone || ""}
                  onChangeText={(text) => updateField("phone", text)}
                  placeholder="Teléfono"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="phone-pad"
                />

                {/* Tipo */}
                <Text style={[styles.label, { color: theme.text }]}>
                  Tipo de negocio
                </Text>
                <View style={styles.typeRow}>
                  {[
                    { key: "restaurant", label: "Restaurante" },
                    { key: "market", label: "Mercado" },
                    { key: "grocery", label: "Supermercado" },
                    { key: "pharmacy", label: "Farmacia" },
                  ].map((type) => (
                    <TouchableOpacity
                      key={type.key}
                      onPress={() => updateField("type", type.key)}
                      style={[
                        styles.typeChip,
                        {
                          backgroundColor:
                            selectedBusiness.type === type.key
                              ? ComeYaColors.primary
                              : theme.backgroundSecondary,
                          borderColor:
                            selectedBusiness.type === type.key
                              ? ComeYaColors.primary
                              : theme.border,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color:
                            selectedBusiness.type === type.key
                              ? "#fff"
                              : theme.text,
                          fontWeight: "600",
                          fontSize: 13,
                        }}
                      >
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Comisión */}
                <Text style={[styles.label, { color: theme.text }]}>
                  Comisión personalizada (%)
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.backgroundSecondary,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  value={customCommission}
                  onChangeText={setCustomCommission}
                  placeholder="Vacío = usar comisión global del sistema"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="decimal-pad"
                />

                {/* Estado */}
                <Text style={[styles.label, { color: theme.text }]}>
                  Estado
                </Text>
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[
                      styles.button,
                      {
                        backgroundColor: selectedBusiness.isActive
                          ? ComeYaColors.success
                          : theme.backgroundSecondary,
                        borderWidth: 1,
                        borderColor: selectedBusiness.isActive
                          ? ComeYaColors.success
                          : theme.border,
                      },
                    ]}
                    onPress={() => updateField("isActive", true)}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        {
                          color: selectedBusiness.isActive
                            ? "#fff"
                            : theme.text,
                        },
                      ]}
                    >
                      Activo
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.button,
                      {
                        backgroundColor: !selectedBusiness.isActive
                          ? ComeYaColors.error
                          : theme.backgroundSecondary,
                        borderWidth: 1,
                        borderColor: !selectedBusiness.isActive
                          ? ComeYaColors.error
                          : theme.border,
                      },
                    ]}
                    onPress={() => updateField("isActive", false)}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        {
                          color: !selectedBusiness.isActive
                            ? "#fff"
                            : theme.text,
                        },
                      ]}
                    >
                      Inactivo
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    {
                      backgroundColor: ComeYaColors.primary,
                      opacity: saving ? 0.6 : 1,
                    },
                  ]}
                  onPress={handleSaveBusiness}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Feather name="save" size={16} color="#fff" />
                      <Text style={[styles.buttonText, { color: "#fff" }]}>
                        Guardar cambios
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

function InfoRow({
  icon,
  label,
  value,
  theme,
}: {
  icon: any;
  label: string;
  value: string;
  theme: any;
}) {
  return (
    <View style={styles.infoRow}>
      <Feather name={icon} size={14} color={theme.textSecondary} />
      <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
        {label}
      </Text>
      <Text style={[styles.infoValue, { color: theme.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pendingSection: {
    marginBottom: 16,
  },
  pendingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  pendingTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  pendingCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  verifyButtonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
  },
  verifyButton: {
    flexDirection: "row",
    gap: 6,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardImage: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  businessHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  businessName: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  businessType: {
    fontSize: 13,
    marginTop: 2,
  },
  businessAddress: {
    fontSize: 12,
    marginTop: 2,
  },
  businessPhone: {
    fontSize: 12,
    marginTop: 2,
  },
  commissionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  commissionText: {
    fontSize: 12,
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: "92%",
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  modalImage: {
    width: 110,
    height: 110,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  infoBox: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 5,
  },
  infoLabel: {
    fontSize: 13,
    width: 90,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  input: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 16,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: Spacing.sm,
  },
  typeChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  buttonRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    borderWidth: 1,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
