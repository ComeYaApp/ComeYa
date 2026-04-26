import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, TextInput, Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { ComeYaColors, Spacing, BorderRadius } from "../../../constants/theme";
import { Business } from "../types/admin.types";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";

interface BusinessesTabProps {
  businesses: Business[];
  onBusinessPress: (business: Business) => void;
}

export const BusinessesTab: React.FC<BusinessesTabProps> = ({
  businesses,
  onBusinessPress,
}) => {
  const { theme } = useTheme();
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [customCommission, setCustomCommission] = useState("");
  const [saving, setSaving] = useState(false);

  const handleBusinessPress = (business: Business) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedBusiness(business);
    setCustomCommission(business.customCommission?.toString() || "");
    setModalVisible(true);
  };

  const handleSaveCommission = async () => {
    if (!selectedBusiness) return;

    const commissionValue = customCommission.trim() === "" ? null : parseFloat(customCommission);

    if (commissionValue !== null && (isNaN(commissionValue) || commissionValue < 0 || commissionValue > 100)) {
      Alert.alert("Error", "La comisión debe ser un número entre 0 y 100, o déjalo vacío para usar la comisión global.");
      return;
    }

    setSaving(true);
    try {
      await apiRequest("PUT", `/api/admin/businesses/${selectedBusiness.id}/commission`, {
        customCommission: commissionValue,
      });

      Alert.alert(
        "Éxito",
        commissionValue === null
          ? "Se usará la comisión global del sistema"
          : `Comisión personalizada establecida en ${commissionValue}%`
      );

      setModalVisible(false);
      // Actualizar la lista
      onBusinessPress(selectedBusiness);
    } catch (error: any) {
      Alert.alert("Error", error.message || "No se pudo actualizar la comisión");
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <>
      <ScrollView style={styles.container}>
        {businesses.map((business) => (
          <TouchableOpacity
            key={business.id}
            style={[styles.card, { backgroundColor: theme.card }]}
            onPress={() => handleBusinessPress(business)}
          >
            <View style={styles.businessHeader}>
              <Text style={[styles.businessName, { color: theme.text }]}>{business.name}</Text>
              <View style={[
                styles.statusBadge,
                { backgroundColor: business.isActive ? ComeYaColors.success : ComeYaColors.error }
              ]}>
                <Text style={styles.statusText}>
                  {business.isActive ? 'Activo' : 'Inactivo'}
                </Text>
              </View>
            </View>
            <Text style={[styles.businessType, { color: theme.textSecondary }]}>{business.type === 'restaurant' ? 'Restaurante' : 'Mercado'}</Text>
            <Text style={[styles.businessAddress, { color: theme.textSecondary }]}>{business.address || 'Sin dirección'}</Text>
            <Text style={[styles.businessPhone, { color: theme.textSecondary }]}>{business.phone || 'Sin teléfono'}</Text>
            <View style={styles.commissionRow}>
              <Feather name="percent" size={14} color={ComeYaColors.primary} />
              <Text style={[styles.commissionText, { color: theme.textSecondary }]}>
                Comisión: {business.customCommission !== null && business.customCommission !== undefined ? `${business.customCommission}% (personalizada)` : "Global del sistema"}
              </Text>
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
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Comisión Personalizada</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={[styles.businessNameModal, { color: theme.text }]}>{selectedBusiness?.name}</Text>
              
              <Text style={[styles.label, { color: theme.text }]}>Comisión (%)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                value={customCommission}
                onChangeText={setCustomCommission}
                placeholder="Ej: 15 (vacío = usar global)"
                placeholderTextColor={theme.textSecondary}
                keyboardType="decimal-pad"
              />

              <View style={[styles.infoBox, { backgroundColor: ComeYaColors.primary + "10" }]}>
                <Feather name="info" size={16} color={ComeYaColors.primary} />
                <Text style={[styles.infoText, { color: ComeYaColors.primary }]}>
                  Deja vacío para usar la comisión global del sistema. Ingresa un número entre 0-100 para establecer una comisión personalizada.
                </Text>
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton, { borderColor: theme.border }]}
                  onPress={() => setModalVisible(false)}
                  disabled={saving}
                >
                  <Text style={[styles.buttonText, { color: theme.text }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.saveButton, { backgroundColor: ComeYaColors.primary }]}
                  onPress={handleSaveCommission}
                  disabled={saving}
                >
                  <Text style={[styles.buttonText, { color: "#fff" }]}>
                    {saving ? "Guardando..." : "Guardar"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  businessHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
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
    fontSize: 14,
    marginBottom: 4,
  },
  businessAddress: {
    fontSize: 12,
    marginBottom: 4,
  },
  businessPhone: {
    fontSize: 12,
    marginBottom: 8,
  },
  commissionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 6,
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
    paddingBottom: Spacing.xl,
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
  modalBody: {
    padding: Spacing.lg,
  },
  businessNameModal: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  input: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 16,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  infoBox: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: "row",
    gap: Spacing.md,
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
    // backgroundColor set inline
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
